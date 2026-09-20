export interface Profile {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  created_at: string;
  role?: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'banned' | 'deactivated' | 'restricted';
  // Campos preparados para futuras métricas (NO renderizados en V0.1)
  future_metrics?: {
    dynamos_count?: number;
    active_dynamos_count?: number;
    followers_count?: number;
    following_count?: number;
    total_energy_received?: number;
  };
}

export interface EditProfileDTO {
  username?: string;
  avatar?: string;
  bio?: string;
}
