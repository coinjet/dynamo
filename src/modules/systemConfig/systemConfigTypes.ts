export interface SystemSettings {
  // Global Switches (Bloque 1.1)
  allow_new_registrations: boolean;
  allow_new_posts: boolean;
  allow_new_replies: boolean;
  allow_images: boolean;
  allow_dynamos: boolean;
  allow_notifications: boolean;
  allow_sponsorships: boolean;
  allow_advertising: boolean;
  maintenance_mode: boolean;
  emergency_mode: boolean;
  maintenance_notice: string | null;

  // External Telegram Support & Community Channels (Bloque 1.2)
  telegram_support_url?: string;
  telegram_community_url?: string;

  // Backwards compatibility aliases
  allow_registrations?: boolean;
  allow_publications?: boolean;
  allow_media_uploads?: boolean;

  updated_at?: string;
  updated_by?: string;
}

export type CommunicationType =
  | 'general'
  | 'mantenimiento'
  | 'seguridad'
  | 'comunidad'
  | 'personal';

export type CommunicationStatus = 'scheduled' | 'sent' | 'cancelled' | 'failed';

export interface AdminAnnouncement {
  id: string;
  admin_id: string;
  admin_username?: string;
  target_scope: 'general' | 'individual';
  target_user_id?: string | null;
  target_username?: string | null;
  title: string;
  message: string;
  is_pinned: boolean;
  communication_type: CommunicationType;
  status: CommunicationStatus;
  scheduled_for?: string | null;
  sent_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  created_at: string;
}

export type LegalSectionId =
  | 'about'
  | 'terms'
  | 'privacy'
  | 'community'
  | 'safety'
  | 'support'
  | 'community_info';

export interface SystemLegalDocument {
  id: LegalSectionId;
  title: string;
  content: string;
  updated_at: string;
  updated_by?: string | null;
}

export const LEGAL_SECTIONS_META: Record<
  LegalSectionId,
  { title: string; subtitle: string; icon: string }
> = {
  about: {
    title: 'Acerca de Dynamo',
    subtitle: 'Misión, visión de comunidad y manifiesto del proyecto',
    icon: 'Info',
  },
  terms: {
    title: 'Términos y Condiciones',
    subtitle: 'Condiciones de uso, directrices contractuales y responsabilidades',
    icon: 'FileText',
  },
  privacy: {
    title: 'Política de Privacidad',
    subtitle: 'Compromiso de anonimato estricto, no PII y retención de datos',
    icon: 'Shield',
  },
  community: {
    title: 'Normas de la Comunidad',
    subtitle: 'Reglas de convivencia, respeto mutuo y tolerancia cero a abusos',
    icon: 'HeartHandshake',
  },
  safety: {
    title: 'Seguridad',
    subtitle: 'Protección técnica, reportes y salvaguarda de usuarios',
    icon: 'Lock',
  },
  support: {
    title: 'Soporte',
    subtitle: 'Canales oficiales de asistencia, preguntas frecuentes y contacto',
    icon: 'HelpCircle',
  },
  community_info: {
    title: 'Comunidad',
    subtitle: 'Espacios de encuentro, dinamismo colectivo y participación',
    icon: 'Users',
  },
};

export const UNPUBLISHED_LEGAL_PLACEHOLDER = 'Contenido pendiente de publicación';

export interface AdSlotConfig {
  id: string;
  name: string;
  placement: 'feed_inline' | 'discovery_top' | 'detail_bottom';
  is_enabled: boolean;
  provider: 'none' | 'adsterra' | 'google_ads' | 'custom';
  code_snippet?: string | null;
  updated_at?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  allow_new_registrations: true,
  allow_new_posts: true,
  allow_new_replies: true,
  allow_images: false,
  allow_dynamos: true,
  allow_notifications: true,
  allow_sponsorships: false,
  allow_advertising: false,
  maintenance_mode: false,
  emergency_mode: false,
  maintenance_notice: null,
  telegram_support_url: '',
  telegram_community_url: '',

  // Compatibility defaults
  allow_registrations: true,
  allow_publications: true,
  allow_media_uploads: false,
};
