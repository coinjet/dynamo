import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import {
  SystemSettings,
  AdminAnnouncement,
  AdSlotConfig,
  DEFAULT_SYSTEM_SETTINGS,
} from './systemConfigTypes';

export const systemConfigService = {
  /**
   * Fetch current global system settings directly from Supabase system_settings table.
   * Strictly avoids localStorage fallback for administrative operations.
   */
  async getSettings(): Promise<SystemSettings> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('system_settings').select('*');
      if (error) {
        throw new Error(`Error al cargar configuración del sistema desde Supabase: ${error.message}`);
      }

      const config: any = { ...DEFAULT_SYSTEM_SETTINGS };
      if (data && data.length > 0) {
        data.forEach((row: any) => {
          config[row.key] = row.value;
        });

        // Mirror legacy / alternative switch names for backwards compatibility
        if (config.allow_new_registrations !== undefined) {
          config.allow_registrations = config.allow_new_registrations;
        }
        if (config.allow_new_posts !== undefined) {
          config.allow_publications = config.allow_new_posts;
        }
        if (config.allow_images !== undefined) {
          config.allow_media_uploads = config.allow_images;
        }
      }
      return config;
    }

    // In local non-configured mode, return defaults directly
    return DEFAULT_SYSTEM_SETTINGS;
  },

  /**
   * Update a system setting (admin-only, server-side validated, atomic and audited).
   * Strictly calls Supabase RPC admin_update_system_setting.
   */
  async updateSetting(
    key: keyof SystemSettings,
    value: any,
    adminId: string,
    reason?: string
  ): Promise<void> {
    if (!adminId) {
      throw new Error('Permisos insuficientes: se requiere usuario administrador autenticado.');
    }

    if (!reason || reason.trim().length < 3) {
      throw new Error('Debes ingresar obligatoriamente un motivo de auditoría (mínimo 3 caracteres).');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    // Call Supabase RPC admin_update_system_setting with native value so JSONB receives true/false literals, not "\"true\"" strings
    const { error } = await supabase.rpc('admin_update_system_setting', {
      p_key: key,
      p_value: value,
      p_reason: reason.trim(),
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get detailed state and audit history for a specific system switch (e.g. allow_images).
   * Respects privacy rules by resolving admin username while NEVER exposing emails or private data.
   */
  async getSettingAuditDetails(key: string): Promise<{
    currentValue: any;
    updatedAt: string | null;
    adminUsername: string | null;
    lastReason: string | null;
    history: Array<{
      id: string;
      createdAt: string;
      adminUsername: string;
      reason: string;
      newValue: any;
    }>;
  }> {
    if (!isSupabaseConfigured) {
      return {
        currentValue: false,
        updatedAt: null,
        adminUsername: null,
        lastReason: null,
        history: [],
      };
    }

    try {
      // 1. Fetch current row
      const { data: settingRow } = await supabase
        .from('system_settings')
        .select('key, value, updated_at, updated_by, profiles:updated_by(username)')
        .eq('key', key)
        .maybeSingle();

      // 2. Fetch audit actions for this setting
      const { data: auditRows } = await supabase
        .from('moderation_actions')
        .select('id, admin_id, reason, created_at, metadata, target_id, profiles:admin_id(username)')
        .eq('target_id', key)
        .order('created_at', { ascending: false })
        .limit(10);

      const history = (auditRows || []).map((row: any) => ({
        id: row.id,
        createdAt: row.created_at,
        adminUsername: row.profiles?.username || 'admin',
        reason: row.reason,
        newValue: row.metadata?.new_value !== undefined ? row.metadata.new_value : null,
      }));

      const lastReason = history.length > 0 ? history[0].reason : null;
      const adminUsername =
        (settingRow as any)?.profiles?.username ||
        (history.length > 0 ? history[0].adminUsername : null);

      return {
        currentValue: settingRow ? settingRow.value : null,
        updatedAt: settingRow ? settingRow.updated_at : null,
        adminUsername,
        lastReason,
        history,
      };
    } catch (err) {
      console.warn('Error in getSettingAuditDetails:', err);
      return {
        currentValue: null,
        updatedAt: null,
        adminUsername: null,
        lastReason: null,
        history: [],
      };
    }
  },

  /**
   * Get list of official announcements directly from Supabase.
   */
  async getAnnouncements(): Promise<AdminAnnouncement[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    const { data, error } = await supabase
      .from('admin_announcements')
      .select(`
        *,
        admin:admin_id(username),
        target_user:target_user_id(username)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al consultar comunicados en Supabase: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      admin_id: r.admin_id,
      admin_username: r.admin?.username || 'admin',
      target_scope: r.target_scope,
      target_user_id: r.target_user_id,
      target_username: r.target_user?.username || null,
      title: r.title,
      message: r.message,
      is_pinned: r.is_pinned,
      communication_type: (r.communication_type || 'general') as any,
      status: (r.status || 'sent') as any,
      scheduled_for: r.scheduled_for || null,
      sent_at: r.sent_at || null,
      cancelled_at: r.cancelled_at || null,
      cancelled_by: r.cancelled_by || null,
      created_at: r.created_at,
    }));
  },

  /**
   * Send or schedule an administrative announcement via Supabase RPC.
   */
  async sendAnnouncement(
    params: {
      target_scope: 'general' | 'individual';
      target_user_id?: string | null;
      title: string;
      message: string;
      is_pinned?: boolean;
      communication_type?: 'general' | 'mantenimiento' | 'seguridad' | 'comunidad' | 'personal';
      scheduled_for?: string | null;
    },
    adminId: string
  ): Promise<{ success: boolean; announcement_id: string; status: string; scheduled_for?: string | null }> {
    if (!adminId) throw new Error('Usuario administrador o moderador autenticado requerido.');
    if (!params.title.trim() || !params.message.trim()) {
      throw new Error('El título y el mensaje no pueden estar vacíos.');
    }
    if (params.target_scope === 'individual' && !params.target_user_id) {
      throw new Error('Debes seleccionar un usuario objetivo para mensajes individuales.');
    }

    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    const { data, error } = await supabase.rpc('admin_send_announcement', {
      p_target_scope: params.target_scope,
      p_target_user_id: params.target_user_id || null,
      p_title: params.title.trim(),
      p_message: params.message.trim(),
      p_is_pinned: Boolean(params.is_pinned),
      p_communication_type: params.communication_type || 'general',
      p_scheduled_for: params.scheduled_for || null,
    });

    if (error) {
      throw new Error(error.message);
    }

    return data as any;
  },

  /**
   * Cancel a pending scheduled announcement via Supabase RPC.
   */
  async cancelScheduledAnnouncement(
    announcementId: string,
    reason?: string,
    adminId?: string
  ): Promise<void> {
    if (!adminId) throw new Error('Usuario autenticado requerido para cancelar el comunicado.');
    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    const { error } = await supabase.rpc('admin_cancel_scheduled_announcement', {
      p_announcement_id: announcementId,
      p_reason: reason || 'Cancelado desde panel de administración',
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get all configurable legal & support documents from Supabase.
   */
  async getLegalDocuments(): Promise<Record<string, { id: string; title: string; content: string; updated_at: string }>> {
    if (!isSupabaseConfigured) {
      return {};
    }

    const { data, error } = await supabase
      .from('system_legal_content')
      .select('*');

    if (error) {
      console.warn('Error fetching legal documents from Supabase:', error);
      return {};
    }

    const result: Record<string, any> = {};
    (data || []).forEach((doc: any) => {
      result[doc.id] = {
        id: doc.id,
        title: doc.title,
        content: doc.content || '',
        updated_at: doc.updated_at,
        updated_by: doc.updated_by,
      };
    });
    return result;
  },

  /**
   * Get a specific legal document by ID from Supabase.
   */
  async getLegalDocument(
    id: string
  ): Promise<{ id: string; title: string; content: string; updated_at: string } | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    const { data, error } = await supabase
      .from('system_legal_content')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn(`Error fetching legal doc [${id}]:`, error);
      return null;
    }

    return data
      ? {
          id: data.id,
          title: data.title,
          content: data.content || '',
          updated_at: data.updated_at,
        }
      : null;
  },

  /**
   * Update legal content in Supabase with audit logging via RPC.
   */
  async updateLegalDocument(
    id: string,
    title: string,
    content: string,
    reason?: string,
    adminId?: string
  ): Promise<void> {
    if (!adminId) throw new Error('Usuario administrador autenticado requerido.');
    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    const { error } = await supabase.rpc('admin_update_legal_content', {
      p_id: id,
      p_title: title.trim(),
      p_content: content.trim(),
      p_reason: reason || `Actualización de documento legal: ${title}`,
    });

    if (error) {
      throw new Error(error.message);
    }
  },

  /**
   * Get independent Telegram links for Support and Community.
   */
  async getTelegramLinks(): Promise<{ supportUrl: string; communityUrl: string }> {
    if (!isSupabaseConfigured) {
      return { supportUrl: '', communityUrl: '' };
    }

    const { data, error } = await supabase
      .from('system_settings')
      .select('key, value')
      .in('key', ['telegram_support_url', 'telegram_community_url']);

    if (error) {
      console.warn('Error fetching telegram links:', error);
      return { supportUrl: '', communityUrl: '' };
    }

    let supportUrl = '';
    let communityUrl = '';

    (data || []).forEach((row: any) => {
      if (row.key === 'telegram_support_url') {
        supportUrl = typeof row.value === 'string' ? row.value : String(row.value || '').replace(/^"|"$/g, '');
      }
      if (row.key === 'telegram_community_url') {
        communityUrl = typeof row.value === 'string' ? row.value : String(row.value || '').replace(/^"|"$/g, '');
      }
    });

    return { supportUrl, communityUrl };
  },

  /**
   * Update independent Telegram links via audited system settings RPC.
   */
  async updateTelegramLinks(
    params: { supportUrl: string; communityUrl: string },
    adminId: string
  ): Promise<void> {
    if (!adminId) throw new Error('Usuario administrador autenticado requerido.');
    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado.');
    }

    await this.updateSetting(
      'telegram_support_url',
      params.supportUrl.trim(),
      'Actualización de enlace Telegram de Soporte',
      adminId
    );

    await this.updateSetting(
      'telegram_community_url',
      params.communityUrl.trim(),
      'Actualización de enlace Telegram de Comunidad',
      adminId
    );
  },

  /**
   * Get advertising slots directly from Supabase.
   */
  async getAdSlots(): Promise<AdSlotConfig[]> {
    if (!isSupabaseConfigured) {
      return [];
    }

    const { data, error } = await supabase.from('ad_slots').select('*');
    if (error) {
      throw new Error(`Error al consultar espacios publicitarios en Supabase: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Update an ad slot directly in Supabase ad_slots table.
   */
  async updateAdSlot(
    slotId: string,
    updates: Partial<AdSlotConfig>,
    adminId: string
  ): Promise<void> {
    if (!adminId) throw new Error('Usuario administrador autenticado requerido.');

    if (!isSupabaseConfigured) {
      throw new Error('Operación rechazada: Supabase no está configurado en este entorno.');
    }

    const { error } = await supabase
      .from('ad_slots')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
      .eq('id', slotId);

    if (error) {
      throw new Error(error.message);
    }
  },
};
