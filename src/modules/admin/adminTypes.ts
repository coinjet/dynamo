import { ReportReason, ReportStatus } from '@/src/modules/moderation/moderationTypes';

export type AdminRole = 'admin' | 'moderator';

export interface AdminAccessVerification {
  isAuthorized: boolean;
  role: AdminRole | null;
  username?: string;
  userId?: string;
  message?: string;
}

export interface AdminDashboardStats {
  pending_reports: number;
  reviewed_reports: number;
  resolved_reports: number;
  dismissed_reports: number;
  suspended_users: number;
  banned_users: number;
  hidden_dynamos: number;
  hidden_replies: number;
  hidden_content: number;
  total_reports: number;
  total_users?: number;
  active_dynamos?: number;
}

export interface AdminReportItem {
  id: string;
  created_at: string;
  content_type: 'dynamo' | 'reply';
  content_id: string;
  content_text: string;
  content_status: 'active' | 'hidden' | 'deleted';
  author_id: string;
  author_username: string;
  author_avatar?: string;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus; // pending, reviewed, resolved, dismissed
  last_action?: string | null;
}

export interface AdminReportsFilterParams {
  status?: 'all' | ReportStatus;
  category?: 'all' | ReportReason;
  contentType?: 'all' | 'dynamo' | 'reply';
  searchQuery?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserItem {
  id: string;
  username: string;
  avatar: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'banned' | 'restricted' | 'deactivated';
  created_at: string;
  reports_against_count?: number;
}

export interface AdminUsersFilterParams {
  status?: 'all' | 'active' | 'suspended' | 'banned';
  searchQuery?: string;
  page: number;
  pageSize: number;
}

export interface AdminAuditLogItem {
  id: string;
  admin_id: string;
  admin_username?: string;
  action: string;
  target_type: 'dynamo' | 'reply' | 'user';
  target_id: string;
  target_label?: string;
  reason?: string;
  created_at: string;
}

export interface AdminGrowthFunnel {
  clicks: number;
  landing_views: number;
  signup_started: number;
  signup_completed: number;
  email_confirmed: number;
  first_dynamo: number;
  first_interaction: number;
  total_inviters: number;
  total_referred_users: number;
  total_confirmed_referred: number;
  total_first_dynamo: number;
  total_first_interaction: number;
  click_to_signup_rate: number;
  signup_to_confirmed_rate: number;
  confirmed_to_active_rate: number;
}

export interface AdminGrowthInviterItem {
  inviter_id: string;
  inviter_username: string;
  inviter_avatar: string;
  referral_code: string;
  code_created_at: string;
  active: boolean;
  clicks: number;
  signups: number;
  confirmations: number;
  first_dynamos: number;
  first_interactions: number;
}

export interface AdminGrowthFilterParams {
  searchQuery?: string;
  page: number;
  pageSize: number;
}
