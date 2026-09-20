import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  AdminAccessVerification,
  AdminDashboardStats,
  AdminReportItem,
  AdminReportsFilterParams,
  AdminUserItem,
  AdminUsersFilterParams,
  AdminAuditLogItem,
  PaginatedResult,
} from './adminTypes';
import { ReportStatus, ReportReason } from '@/src/modules/moderation/moderationTypes';
import { moderationService } from '@/src/modules/moderation/moderationService';

export const adminService = {
  /**
   * Verify whether the user has 'admin' or 'moderator' role via server RPC or verified profile.
   * Strictly never trusts unverified client state alone.
   */
  async verifyAccess(userId?: string): Promise<AdminAccessVerification> {
    if (!userId) {
      return {
        isAuthorized: false,
        role: null,
        message: 'Debes iniciar sesión para acceder al panel administrativo.',
      };
    }

    if (!isSupabaseConfigured) {
      return {
        isAuthorized: false,
        role: null,
        message: 'Supabase no está configurado para verificar permisos administrativos.',
      };
    }

    try {
      const { data, error } = await supabase.rpc('check_admin_access');
      if (error || !data) {
        // Fallback to direct secure profile check if RPC is pending migration
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('role, username, status')
          .eq('id', userId)
          .single();

        if (profErr || !prof) {
          return {
            isAuthorized: false,
            role: null,
            message: 'No se encontró el perfil de usuario en la base de datos.',
          };
        }

        const hasRole = prof.role === 'admin' || prof.role === 'moderator';
        const isActive = prof.status === 'active';
        return {
          isAuthorized: hasRole && isActive,
          role: hasRole ? prof.role : null,
          username: prof.username,
          userId,
          message: hasRole && isActive ? undefined : 'Acceso denegado: permisos insuficientes.',
        };
      }

      return {
        isAuthorized: Boolean(data.is_authorized),
        role: data.role || null,
        username: data.username,
        userId: data.user_id || userId,
        message: data.message,
      };
    } catch (err: any) {
      return {
        isAuthorized: false,
        role: null,
        message: err.message || 'Error al validar permisos de administrador.',
      };
    }
  },

  /**
   * Fetch aggregate administrative stats from Supabase
   */
  async getDashboardStats(adminUserId: string): Promise<AdminDashboardStats> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
      if (!error && data) {
        return {
          pending_reports: Number(data.pending_reports || 0),
          reviewed_reports: Number(data.reviewed_reports || 0),
          resolved_reports: Number(data.resolved_reports || 0),
          dismissed_reports: Number(data.dismissed_reports || 0),
          suspended_users: Number(data.suspended_users || 0),
          banned_users: Number(data.banned_users || 0),
          hidden_dynamos: Number(data.hidden_dynamos || 0),
          hidden_replies: Number(data.hidden_replies || 0),
          hidden_content: Number(data.hidden_dynamos || 0) + Number(data.hidden_replies || 0),
          total_reports: Number(data.total_reports || 0),
        };
      }
    } catch {
      // Fall through to direct table counts
    }

    // Direct Supabase table count queries
    const [
      { count: pendingCount },
      { count: reviewedCount },
      { count: resolvedCount },
      { count: dismissedCount },
      { count: suspendedCount },
      { count: bannedCount },
      { count: hiddenDynamosCount },
      { count: hiddenRepliesCount },
      { count: totalUsersCount },
      { count: activeDynamosCount },
    ] = await Promise.all([
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'reviewed'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'dismissed'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'banned'),
      supabase.from('dynamos').select('*', { count: 'exact', head: true }).eq('status', 'hidden'),
      supabase.from('replies').select('*', { count: 'exact', head: true }).eq('status', 'hidden'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('dynamos').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    const pend = pendingCount || 0;
    const rev = reviewedCount || 0;
    const res = resolvedCount || 0;
    const dis = dismissedCount || 0;
    const hDyn = hiddenDynamosCount || 0;
    const hRep = hiddenRepliesCount || 0;

    return {
      pending_reports: pend,
      reviewed_reports: rev,
      resolved_reports: res,
      dismissed_reports: dis,
      suspended_users: suspendedCount || 0,
      banned_users: bannedCount || 0,
      hidden_dynamos: hDyn,
      hidden_replies: hRep,
      hidden_content: hDyn + hRep,
      total_reports: pend + rev + res + dis,
      total_users: totalUsersCount || 0,
      active_dynamos: activeDynamosCount || 0,
    };
  },

  /**
   * Get paginated reports inbox with content and author information directly from Supabase.
   * Strictly keeps reporter identity anonymous!
   */
  async getReports(
    params: AdminReportsFilterParams,
    adminUserId: string
  ): Promise<PaginatedResult<AdminReportItem>> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { status = 'all', category = 'all', contentType = 'all', searchQuery = '', page = 1, pageSize = 10 } = params;

    let query = supabase.from('reports').select('*', { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (category !== 'all') {
      query = query.eq('reason', category);
    }
    if (contentType === 'dynamo') {
      query = query.not('dynamo_id', 'is', null);
    } else if (contentType === 'reply') {
      query = query.not('reply_id', 'is', null);
    }

    query = query.order('created_at', { ascending: false });

    const { data: reports, error: repError } = await query;
    if (repError) throw new Error(repError.message);

    // Fetch related content and authors in batch
    const dynamoIds = (reports || []).map((r) => r.dynamo_id).filter(Boolean);
    const replyIds = (reports || []).map((r) => r.reply_id).filter(Boolean);

    const [dynamosRes, repliesRes] = await Promise.all([
      dynamoIds.length > 0
        ? supabase.from('dynamos').select('id, content, status, user_id, profiles(id, username, avatar)').in('id', dynamoIds)
        : Promise.resolve({ data: [] }),
      replyIds.length > 0
        ? supabase.from('replies').select('id, content, status, user_id, profiles(id, username, avatar)').in('id', replyIds)
        : Promise.resolve({ data: [] }),
    ]);

    const dynamoMap = new Map((dynamosRes.data || []).map((d: any) => [d.id, d]));
    const replyMap = new Map((repliesRes.data || []).map((r: any) => [r.id, r]));

    const items: AdminReportItem[] = (reports || []).map((r: any) => {
      let contentText = '[Contenido no disponible]';
      let contentStatus: 'active' | 'hidden' | 'deleted' = 'active';
      let authorId = '';
      let authorUsername = 'usuario';
      let authorAvatar: string | undefined;

      if (r.dynamo_id && dynamoMap.has(r.dynamo_id)) {
        const item = dynamoMap.get(r.dynamo_id);
        contentText = item.content;
        contentStatus = (item.status === 'hidden' || item.status === 'deleted' ? item.status : 'active') as 'active' | 'hidden' | 'deleted';
        authorId = item.user_id;
        authorUsername = item.profiles?.username || 'usuario';
        authorAvatar = item.profiles?.avatar;
      } else if (r.reply_id && replyMap.has(r.reply_id)) {
        const item = replyMap.get(r.reply_id);
        contentText = item.content;
        contentStatus = (item.status === 'hidden' || item.status === 'deleted' ? item.status : 'active') as 'active' | 'hidden' | 'deleted';
        authorId = item.user_id;
        authorUsername = item.profiles?.username || 'usuario';
        authorAvatar = item.profiles?.avatar;
      }

      return {
        id: r.id,
        created_at: r.created_at,
        content_type: r.dynamo_id ? 'dynamo' : 'reply',
        content_id: r.dynamo_id || r.reply_id,
        content_text: contentText,
        content_status: contentStatus,
        author_id: authorId,
        author_username: authorUsername,
        author_avatar: authorAvatar,
        reason: r.reason,
        description: r.description,
        status: r.status,
      };
    });

    // Apply client filters if search text applied
    let filtered = items;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (i) =>
          i.content_text.toLowerCase().includes(q) ||
          i.author_username.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginatedItems = filtered.slice(startIdx, startIdx + pageSize);

    return {
      items: paginatedItems,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  },

  /**
   * Apply content moderation action (hide/restore) and update report status via Supabase RPC moderate_content
   */
  async moderateContent(
    params: {
      reportId: string;
      newReportStatus?: ReportStatus;
      contentAction?: 'hide_dynamo' | 'restore_dynamo' | 'hide_reply' | 'restore_reply';
      contentId?: string;
      reason: string;
    },
    adminUserId: string
  ): Promise<void> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { reportId, newReportStatus, contentAction, reason } = params;

    // Execute through secure server RPC moderate_content
    const { error } = await supabase.rpc('moderate_content', {
      p_report_id: reportId,
      p_new_report_status: newReportStatus || 'actioned',
      p_content_action: contentAction || null,
      p_reason: reason,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Suspend, ban, or rehabilitate a user via secure server RPC admin_moderate_user
   * Server-side enforces:
   * - Moderator CANNOT ban permanently
   * - Moderator CANNOT sanction fellow moderators or admins
   * - No one can sanction an admin
   * - Only admin can apply permanent ban
   */
  async moderateUser(
    params: {
      targetUserId: string;
      action: 'suspend' | 'ban' | 'rehabilitate';
      reason: string;
    },
    adminUserId: string
  ): Promise<void> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (params.targetUserId === adminUserId) {
      throw new Error('No puedes aplicar sanciones sobre tu propia cuenta.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { targetUserId, action, reason } = params;

    // Execute through secure server RPC admin_moderate_user
    const { error } = await supabase.rpc('admin_moderate_user', {
      p_target_user_id: targetUserId,
      p_action: action,
      p_reason: reason,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get paginated users for user moderation directly from Supabase.
   * Never exposes private data, passwords or tokens!
   */
  async getUsers(
    params: AdminUsersFilterParams,
    adminUserId: string
  ): Promise<PaginatedResult<AdminUserItem>> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { status = 'all', searchQuery = '', page = 1, pageSize = 10 } = params;

    let query = supabase.from('profiles').select('id, username, avatar, role, status, created_at');

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    let users: AdminUserItem[] = (data || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      role: p.role,
      status: p.status,
      created_at: p.created_at,
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      users = users.filter((u) => u.username.toLowerCase().includes(q));
    }

    const total = users.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = users.slice(startIdx, startIdx + pageSize);

    return {
      items: paginated,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  },

  /**
   * Get paginated audit logs directly from Supabase moderation_actions table
   */
  async getAuditLogs(
    page: number,
    pageSize: number,
    adminUserId: string
  ): Promise<PaginatedResult<AdminAuditLogItem>> {
    const access = await this.verifyAccess(adminUserId);
    if (!access.isAuthorized) {
      throw new Error('Acceso denegado: permisos administrativos requeridos.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { data, error } = await supabase
      .from('moderation_actions')
      .select('id, admin_id, action, reason, created_at, target_dynamo_id, target_reply_id, target_user_id, profiles:admin_id(username)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const logs: AdminAuditLogItem[] = (data || []).map((row: any) => {
      let targetType: 'dynamo' | 'reply' | 'user' = 'dynamo';
      let targetId = '';

      if (row.target_dynamo_id) {
        targetType = 'dynamo';
        targetId = row.target_dynamo_id;
      } else if (row.target_reply_id) {
        targetType = 'reply';
        targetId = row.target_reply_id;
      } else if (row.target_user_id) {
        targetType = 'user';
        targetId = row.target_user_id;
      }

      return {
        id: row.id,
        admin_id: row.admin_id,
        admin_username: row.profiles?.username || 'admin',
        action: row.action,
        target_type: targetType,
        target_id: targetId,
        reason: row.reason,
        created_at: row.created_at,
      };
    });

    const total = logs.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const paginated = logs.slice(startIdx, startIdx + pageSize);

    return {
      items: paginated,
      total,
      page: safePage,
      pageSize,
      totalPages,
    };
  },
};
