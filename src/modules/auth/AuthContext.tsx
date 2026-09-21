import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AuthSession,
  SignInParams,
  SignUpParams,
  UserProfile,
  ResetPasswordParams,
  UpdatePasswordParams,
} from './authTypes';
import { authService } from './authService';
import { profilesService } from '@/src/modules/profiles/profilesService';
import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';

interface AuthContextType {
  session: AuthSession | null;
  user: AuthSession['user'] | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isRecoveryMode: boolean;
  isEmailConfirmed: boolean;
  clearRecoveryMode: () => void;
  signIn: (params: SignInParams) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  sendPasswordReset: (params: ResetPasswordParams) => Promise<{ message: string }>;
  updatePassword: (params: UpdatePasswordParams) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileState: (fields: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
  resendConfirmationEmail: () => Promise<void>;
  checkEmailConfirmation: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  // Initialize session and listen to Supabase Auth State changes
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const initial = await authService.getInitialSession();
      if (isMounted) {
        setSession(initial);
        setIsLoading(false);
      }
    }

    init();

    // Check for password recovery hash in URL (e.g. #type=recovery&access_token=...)
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true);
    }

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
        if (!isMounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        }

        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') && currentSession) {
          const profile = await profilesService.getProfile(currentSession.user.id);
          if (profile && isMounted) {
            const email_confirmed_at =
              currentSession.user.email_confirmed_at || (currentSession.user as any).confirmed_at || null;
            setSession({
              user: {
                id: currentSession.user.id,
                email: currentSession.user.email,
                email_confirmed_at,
              },
              profile,
            });
          }
        } else if (event === 'SIGNED_OUT') {
          if (isMounted) {
            setSession(null);
          }
        }
      });

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (params: SignInParams) => {
    setIsLoading(true);
    try {
      const newSession = await authService.signIn(params);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (params: SignUpParams) => {
    setIsLoading(true);
    try {
      const newSession = await authService.signUp(params);
      setSession(newSession);
    } finally {
      setIsLoading(false);
    }
  };

  const sendPasswordReset = async (params: ResetPasswordParams) => {
    return authService.sendPasswordReset(params);
  };

  const updatePassword = async (params: UpdatePasswordParams) => {
    setIsLoading(true);
    try {
      await authService.updatePassword(params);
      setIsRecoveryMode(false);
      // Clean recovery hash from URL if present
      if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setSession(null);
  };

  const updateProfileState = (updatedFields: Partial<UserProfile>) => {
    if (!session) return;
    const updated: AuthSession = {
      ...session,
      profile: {
        ...session.profile,
        ...updatedFields,
      },
    };
    setSession(updated);
    localStorage.setItem('dynamo_auth_session', JSON.stringify(updated));
  };

  const refreshProfile = async () => {
    if (!session?.user?.id) return;
    const refreshed = await profilesService.getProfile(session.user.id);
    if (refreshed) {
      updateProfileState(refreshed);
    }
  };

  const isEmailConfirmed = Boolean(
    !session?.user ||
    !isSupabaseConfigured ||
    session.user.email_confirmed_at
  );

  const resendConfirmationEmail = async () => {
    if (!session?.user?.email) {
      throw new Error('No hay una dirección de correo asociada a la sesión.');
    }
    await authService.resendConfirmationEmail(session.user.email);
  };

  const checkEmailConfirmation = async (): Promise<boolean> => {
    const result = await authService.checkEmailConfirmation();
    if (result.isConfirmed && session?.user) {
      const updated: AuthSession = {
        ...session,
        user: {
          ...session.user,
          email_confirmed_at: result.email_confirmed_at,
        },
      };
      setSession(updated);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session ? session.user : null,
        profile: session ? session.profile : null,
        isLoading,
        isRecoveryMode,
        isEmailConfirmed,
        clearRecoveryMode: () => setIsRecoveryMode(false),
        signIn,
        signUp,
        sendPasswordReset,
        updatePassword,
        signOut,
        updateProfileState,
        refreshProfile,
        resendConfirmationEmail,
        checkEmailConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
