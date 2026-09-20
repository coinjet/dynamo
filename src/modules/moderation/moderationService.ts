import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { ReportDTO, Report, ReportStatus, ReportReason } from './moderationTypes';
import { sanitizeText, detectSpamPattern } from '@/src/lib/sanitizer';

export const moderationService = {
  validateContentSafety(text: string): { safe: boolean; reason?: string } {
    if (detectSpamPattern(text)) {
      return { safe: false, reason: 'El mensaje parece spam o contiene caracteres repetidos excesivos.' };
    }

    const forbidden = [/javascript:/i, /<script>/i, /onerror=/i];
    for (const pattern of forbidden) {
      if (pattern.test(text)) {
        return { safe: false, reason: 'Contenido no permitido por razones de seguridad.' };
      }
    }

    return { safe: true };
  },

  /**
   * Checks if user already reported this item (dynamo or reply) via Supabase
   */
  async hasUserReported(userId: string, dynamoId?: string, replyId?: string): Promise<boolean> {
    if (!userId) return false;
    if (!dynamoId && !replyId) return false;

    if (!isSupabaseConfigured) return false;

    let query = supabase.from('reports').select('id').eq('reporter_id', userId);
    if (dynamoId) {
      query = query.eq('dynamo_id', dynamoId);
    } else if (replyId) {
      query = query.eq('reply_id', replyId);
    }
    const { data, error } = await query.limit(1);
    if (error || !data) return false;
    return data.length > 0;
  },

  /**
   * Submit a content report (Dynamo or Reply)
   * Enforces server-side validations via Supabase RPC submit_content_report:
   * - No self-reporting
   * - No duplicate reports from the same account
   * - Valid reason category
   * - Rate limit per reporter (max 10/hour)
   * - Max 300 chars sanitized description
   * - Protected reporter anonymity
   */
  async submitReport(dto: ReportDTO, reporterId: string): Promise<Report> {
    if (!reporterId) {
      throw new Error('Debes iniciar sesión para reportar contenido.');
    }

    if (!dto.dynamoId && !dto.replyId) {
      throw new Error('Debes especificar un Dynamo o una respuesta para reportar.');
    }

    if (dto.dynamoId && dto.replyId) {
      throw new Error('No puedes reportar un Dynamo y una respuesta al mismo tiempo.');
    }

    const validReasons: ReportReason[] = [
      'harassment',
      'violence',
      'doxxing',
      'sexual',
      'spam',
      'fraud',
      'impersonation',
      'hate_speech',
      'other',
    ];
    if (!validReasons.includes(dto.reason)) {
      throw new Error('Categoría de reporte no válida.');
    }

    const cleanDescription = dto.description ? sanitizeText(dto.description).slice(0, 300) : '';

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado para registrar reportes.');
    }

    // Use server-side RPC procedure to guarantee database-level enforcement
    const { data, error } = await supabase.rpc('submit_content_report', {
      p_dynamo_id: dto.dynamoId || null,
      p_reply_id: dto.replyId || null,
      p_reason: dto.reason,
      p_description: cleanDescription || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return {
      id: data,
      reporter_id: reporterId,
      dynamo_id: dto.dynamoId || null,
      reply_id: dto.replyId || null,
      reason: dto.reason,
      description: cleanDescription || null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
  },

  // ============================================================================
  // ADMINISTRATIVE / MODERATION BACKEND API
  // Strictly delegates to Supabase RPCs and tables with zero LocalStorage fallbacks.
  // ============================================================================

  /**
   * Query reports (restricted to admin/moderator roles)
   */
  async getReports(adminUserId: string, filterStatus?: ReportStatus): Promise<Report[]> {
    if (!adminUserId) throw new Error('No autorizado: se requiere identificador de administrador.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    let query = supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (filterStatus) {
      query = query.eq('status', filterStatus);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Update report review status: pending / reviewed / resolved / dismissed
   * Executes through secure server RPC moderate_content.
   */
  async updateReportStatus(
    reportId: string,
    newStatus: ReportStatus,
    adminUserId: string,
    reason?: string
  ): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase.rpc('moderate_content', {
      p_report_id: reportId,
      p_new_report_status: newStatus,
      p_content_action: null,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Hide a Dynamo from feeds, discovery, energy gifts, and replies
   */
  async hideDynamo(dynamoId: string, adminUserId: string, reason?: string): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase
      .from('dynamos')
      .update({ status: 'hidden' })
      .eq('id', dynamoId);
    if (error) throw new Error(error.message);

    await supabase.from('moderation_actions').insert({
      target_dynamo_id: dynamoId,
      admin_id: adminUserId,
      action: 'hide_dynamo',
      reason: reason || 'Ocultado por moderación',
    });
  },

  /**
   * Restore a hidden Dynamo to active status
   */
  async restoreDynamo(dynamoId: string, adminUserId: string, reason?: string): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase
      .from('dynamos')
      .update({ status: 'active' })
      .eq('id', dynamoId);
    if (error) throw new Error(error.message);

    await supabase.from('moderation_actions').insert({
      target_dynamo_id: dynamoId,
      admin_id: adminUserId,
      action: 'restore_dynamo',
      reason: reason || 'Restaurado por moderación',
    });
  },

  /**
   * Hide a reply from views
   */
  async hideReply(replyId: string, adminUserId: string, reason?: string): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase
      .from('replies')
      .update({ status: 'hidden' })
      .eq('id', replyId);
    if (error) throw new Error(error.message);

    await supabase.from('moderation_actions').insert({
      target_reply_id: replyId,
      admin_id: adminUserId,
      action: 'hide_reply',
      reason: reason || 'Ocultado por moderación',
    });
  },

  /**
   * Restore a hidden reply
   */
  async restoreReply(replyId: string, adminUserId: string, reason?: string): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase
      .from('replies')
      .update({ status: 'active' })
      .eq('id', replyId);
    if (error) throw new Error(error.message);

    await supabase.from('moderation_actions').insert({
      target_reply_id: replyId,
      admin_id: adminUserId,
      action: 'restore_reply',
      reason: reason || 'Restaurada por moderación',
    });
  },

  /**
   * Restrict, suspend or restore a user account via moderate_user RPC
   */
  async setUserStatus(
    targetUserId: string,
    status: 'active' | 'restricted' | 'suspended',
    adminUserId: string,
    reason?: string
  ): Promise<void> {
    if (!adminUserId) throw new Error('Usuario administrador requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Supabase no está configurado.');
    }

    const { error } = await supabase.rpc('moderate_user', {
      p_target_user_id: targetUserId,
      p_new_status: status,
      p_reason: reason || null,
    });
    if (error) throw new Error(error.message);
  },
};
