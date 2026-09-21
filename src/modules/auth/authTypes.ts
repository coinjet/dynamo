export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  created_at: string;
  role?: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'banned' | 'deactivated' | 'restricted';
}

export interface AuthSession {
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
  };
  profile: UserProfile;
}

export interface SignUpParams {
  email: string;
  password: string;
  confirmPassword: string;
  username: string;
  bio?: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  acceptedCommunityGuidelines: boolean;
  isAgeConfirmed: boolean;
}

export interface SignInParams {
  email: string;
  password: string;
}

export interface ResetPasswordParams {
  email: string;
}

export interface UpdatePasswordParams {
  newPassword: string;
  confirmPassword?: string;
}

export interface UpdateProfileParams {
  username?: string;
  avatar?: string;
  bio?: string;
}
