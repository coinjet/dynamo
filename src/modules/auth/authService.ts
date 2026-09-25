import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  UserProfile,
  SignInParams,
  SignUpParams,
  AuthSession,
  ResetPasswordParams,
  UpdatePasswordParams,
} from './authTypes';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  sanitizeAndValidateBio,
  AUTH_LIMITS,
} from './authValidation';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { referralsService } from '@/src/modules/referrals/referralsService';

export const authService = {
  /**
   * Retrieves active session from Supabase. Zero mock or fake sessions.
   */
  async getInitialSession(): Promise<AuthSession | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error || !session) return null;

      const profile = await profilesService.getProfile(session.user.id);
      if (profile) {
        const email_confirmed_at = session.user.email_confirmed_at || (session.user as any).confirmed_at || null;
        return {
          user: { id: session.user.id, email: session.user.email, email_confirmed_at },
          profile,
        };
      }
    } catch (err) {
      console.warn('Error al verificar sesión de Supabase:', err);
    }

    return null;
  },

  /**
   * Register with email, password, confirmPassword, username, legal consent and min age check.
   */
  async signUp(params: SignUpParams): Promise<AuthSession> {
    // 1. Mandatory legal and age agreements
    if (!params.acceptedTerms || !params.acceptedPrivacy || !params.acceptedCommunityGuidelines) {
      throw new Error(
        'Debes aceptar los Términos de Servicio, la Política de Privacidad y las Normas de la Comunidad para registrarte.'
      );
    }

    if (!params.isAgeConfirmed) {
      throw new Error(
        `Debes confirmar que tienes al menos ${AUTH_LIMITS.MIN_AGE} años para usar Dynamo.`
      );
    }

    // 2. Validate email
    const emailCheck = validateEmail(params.email);
    if (!emailCheck.isValid) {
      throw new Error(emailCheck.error || 'Correo electrónico inválido.');
    }

    // 3. Validate password strength
    const passwordCheck = validatePassword(params.password);
    if (!passwordCheck.isValid) {
      throw new Error(passwordCheck.error || 'Contraseña no cumple con los requisitos de seguridad.');
    }

    // 4. Validate password confirmation
    if (params.password !== params.confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }

    // 5. Validate username
    const cleanUsername = params.username.trim().toLowerCase();
    const usernameCheck = validateUsername(cleanUsername);
    if (!usernameCheck.isValid) {
      throw new Error(usernameCheck.error || 'Nombre de usuario inválido.');
    }

    // 6. Check username uniqueness
    const isAvailable = await profilesService.isUsernameAvailable(cleanUsername);
    if (!isAvailable) {
      throw new Error('El nombre de usuario ya está en uso. Por favor elige otro.');
    }

    // 7. Sanitize bio if provided
    let cleanBio = '';
    if (params.bio) {
      const bioCheck = sanitizeAndValidateBio(params.bio);
      if (!bioCheck.isValid) {
        throw new Error(bioCheck.error || 'Biografía no válida.');
      }
      cleanBio = bioCheck.sanitized;
    }

    if (!isSupabaseConfigured) {
      throw new Error('El servicio de registro no se encuentra disponible.');
    }

    const storedRef = referralsService.getStoredReferralCode();

    // Supabase Authentication
    const { data, error } = await supabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        data: {
          username: cleanUsername,
          bio: cleanBio,
          is_age_confirmed: true,
          min_age_certified: 16,
          accepted_terms: true,
          accepted_privacy: true,
          accepted_community: true,
          referral_code: storedRef || undefined,
        },
      },
    });

    if (error) {
      // Normalize error message without leaking sensitive internal details
      if (error.message.toLowerCase().includes('already registered')) {
        throw new Error('Este correo ya se encuentra registrado. Intenta iniciar sesión.');
      }
      throw new Error('No se pudo completar el registro. Por favor verifica tus datos.');
    }

    if (!data.user) {
      throw new Error('No se pudo crear la cuenta. Intenta de nuevo.');
    }

    // Fetch profile created securely by server-side trigger handle_new_user()
    let { data: fetchedProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, avatar, bio, created_at, role, status')
      .eq('id', data.user.id)
      .maybeSingle();

    // Brief retry in case handle_new_user() trigger execution has a micro-delay
    if (!fetchedProfile) {
      await new Promise((r) => setTimeout(r, 400));
      const retry = await supabase
        .from('profiles')
        .select('id, username, avatar, bio, created_at, role, status')
        .eq('id', data.user.id)
        .maybeSingle();
      fetchedProfile = retry.data;
      profileError = retry.error;
    }

    if (!fetchedProfile) {
      if (import.meta.env.DEV) {
        console.error('[authService.signUp] El trigger server-side handle_new_user() no generó el perfil:', {
          userId: data.user.id,
          error: profileError,
        });
      }
      // Strictly eliminate client-side fallback profile construction / fake objects
      throw new Error('No pudimos cargar tu perfil tras el registro. Por favor, intenta iniciar sesión.');
    }

    // Clear stored referral code after successful sign up
    referralsService.clearStoredReferralCode();

    const email_confirmed_at = data.user.email_confirmed_at || (data.user as any).confirmed_at || null;
    return {
      user: { id: data.user.id, email: data.user.email, email_confirmed_at },
      profile: fetchedProfile as UserProfile,
    };
  },

  /**
   * Log in with email + password. Generic error message prevents credential enumeration.
   */
  async signIn(params: SignInParams): Promise<AuthSession> {
    const email = params.email.trim();
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid || !params.password) {
      throw new Error('Credenciales inválidas. Por favor verifica tu correo y contraseña.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('El servicio de inicio de sesión no se encuentra disponible.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });

    if (error || !data.user) {
      // Generic security-conscious error
      throw new Error('Credenciales incorrectas. Por favor verifica tu correo y contraseña.');
    }

    let profile = await profilesService.getProfile(data.user.id);
    if (!profile) {
      if (import.meta.env.DEV) {
        console.error('[authService.signIn] Perfil no encontrado en base de datos para el usuario autenticado:', data.user.id);
      }
      // Profile must be created server-side by handle_new_user() trigger.
      // Never invent usernames, derive from email, or upsert from client.
      await supabase.auth.signOut();
      throw new Error('No pudimos cargar tu perfil. Inténtalo nuevamente.');
    }

    if (profile.status === 'suspended') {
      await supabase.auth.signOut();
      throw new Error('Esta cuenta ha sido suspendida por el equipo de moderación debido a infracciones de las Normas de la Comunidad.');
    }

    const email_confirmed_at = data.user.email_confirmed_at || (data.user as any).confirmed_at || null;
    return {
      user: { id: data.user.id, email: data.user.email, email_confirmed_at },
      profile,
    };
  },

  /**
   * Resend confirmation email via Supabase Auth.
   */
  async resendConfirmationEmail(email: string): Promise<void> {
    const trimmed = email.trim();
    if (!trimmed) {
      throw new Error('Correo electrónico no especificado.');
    }
    if (isSupabaseConfigured) {
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) {
        throw new Error(error.message || 'No se pudo reenviar el correo de confirmación.');
      }
    }
  },

  /**
   * Checks directly with Supabase whether current user's email is confirmed.
   */
  async checkEmailConfirmation(): Promise<{ isConfirmed: boolean; email_confirmed_at: string | null }> {
    if (!isSupabaseConfigured) {
      return { isConfirmed: true, email_confirmed_at: new Date().toISOString() };
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { isConfirmed: false, email_confirmed_at: null };
    }
    const confirmedAt = data.user.email_confirmed_at || (data.user as any).confirmed_at || null;
    return {
      isConfirmed: Boolean(confirmedAt),
      email_confirmed_at: confirmedAt,
    };
  },

  /**
   * Request password recovery link via Supabase Auth.
   * Safe response prevents email enumeration.
   */
  async sendPasswordReset(params: ResetPasswordParams): Promise<{ message: string }> {
    const email = params.email.trim();
    const emailCheck = validateEmail(email);
    if (!emailCheck.isValid) {
      throw new Error(emailCheck.error || 'Correo electrónico inválido.');
    }

    if (isSupabaseConfigured) {
      const redirectUrl = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.warn('Error al solicitar restablecimiento de contraseña.');
      }
    }

    return {
      message: 'Si el correo electrónico existe en Dynamo, recibirás un enlace para restablecer tu contraseña.',
    };
  },

  /**
   * Update password for an authenticated session or recovery token.
   */
  async updatePassword(params: UpdatePasswordParams): Promise<void> {
    const passwordCheck = validatePassword(params.newPassword);
    if (!passwordCheck.isValid) {
      throw new Error(passwordCheck.error || 'La nueva contraseña no cumple los requisitos de seguridad.');
    }

    if (params.confirmPassword && params.newPassword !== params.confirmPassword) {
      throw new Error('Las contraseñas no coinciden.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.updateUser({
        password: params.newPassword,
      });

      if (error) {
        throw new Error('No se pudo actualizar la contraseña. Por favor intenta nuevamente.');
      }
    }
  },

  /**
   * Log out and terminate persistent session.
   */
  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  },
};
