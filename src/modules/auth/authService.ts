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

const LOCAL_STORAGE_SESSION_KEY = 'dynamo_auth_session';

const DEFAULT_DEMO_USER: UserProfile = {
  id: 'usr_f891a2b3-4c5d-6e7f-8a9b-0c1d2e3f4a5b',
  username: 'sol_valenzuela',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  bio: 'Cronista nocturna. ⚡',
  created_at: '2026-08-15T12:00:00Z',
  role: 'user',
  status: 'active',
};

export const authService = {
  /**
   * Retrieves active session from Supabase or local sandbox.
   */
  async getInitialSession(): Promise<AuthSession | null> {
    if (isSupabaseConfigured) {
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
    }

    // In production without Supabase, never mock sessions or use demo accounts
    if (import.meta.env.PROD && !isSupabaseConfigured) {
      return null;
    }

    // Local-first sandbox fallback
    const saved = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.user?.id && parsed?.profile) {
          return parsed;
        }
      } catch {
        localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      }
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

    // Production check
    if (import.meta.env.PROD && !isSupabaseConfigured) {
      throw new Error('El servicio de registro no se encuentra disponible en este momento.');
    }

    // Supabase Authentication
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signUp({
        email: params.email.trim(),
        password: params.password,
        options: {
          data: {
            username: cleanUsername,
            bio: cleanBio,
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
      const { data: fetchedProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      const profile: UserProfile = fetchedProfile
        ? (fetchedProfile as UserProfile)
        : {
            id: data.user.id,
            username: cleanUsername,
            avatar: '',
            bio: cleanBio,
            created_at: data.user.created_at || new Date().toISOString(),
            role: 'user',
            status: 'active',
          };

      const email_confirmed_at = data.user.email_confirmed_at || (data.user as any).confirmed_at || null;
      return {
        user: { id: data.user.id, email: data.user.email, email_confirmed_at },
        profile,
      };
    }

    // Local Development Sandbox
    const newId = 'usr_' + Math.random().toString(36).substring(2, 10);
    const newProfile: UserProfile = {
      id: newId,
      username: cleanUsername,
      avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanUsername}`,
      bio: cleanBio || 'Explorador en Dynamo.',
      created_at: new Date().toISOString(),
      role: 'user',
      status: 'active',
    };

    const session: AuthSession = {
      user: { id: newId, email: params.email.trim(), email_confirmed_at: new Date().toISOString() },
      profile: newProfile,
    };

    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    return session;
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

    if (import.meta.env.PROD && !isSupabaseConfigured) {
      throw new Error('El servicio de inicio de sesión no se encuentra disponible en este momento.');
    }

    if (isSupabaseConfigured) {
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
        // Fallback create profile if missing
        profile = {
          id: data.user.id,
          username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'usuario',
          avatar: '',
          bio: '',
          created_at: new Date().toISOString(),
          role: 'user',
          status: 'active',
        };
        await supabase.from('profiles').upsert(profile);
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
    }

    // Local Sandbox sign in
    const session: AuthSession = {
      user: { id: DEFAULT_DEMO_USER.id, email, email_confirmed_at: new Date().toISOString() },
      profile: {
        ...DEFAULT_DEMO_USER,
        username: email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || DEFAULT_DEMO_USER.username,
      },
    };
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    return session;
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
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
  },
};
