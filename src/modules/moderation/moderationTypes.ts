export type ReportReason =
  | 'harassment'      // Acoso o intimidación
  | 'violence'        // Amenazas o violencia
  | 'doxxing'         // Datos personales / doxxing
  | 'sexual'          // Contenido sexual inapropiado
  | 'spam'            // Spam
  | 'fraud'           // Estafa o fraude
  | 'impersonation'   // Suplantación
  | 'hate_speech'     // Discurso de odio
  | 'other';          // Otro

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  harassment: 'Acoso o intimidación',
  violence: 'Amenazas o violencia',
  doxxing: 'Datos personales / doxxing',
  sexual: 'Contenido sexual inapropiado',
  spam: 'Spam',
  fraud: 'Estafa o fraude',
  impersonation: 'Suplantación',
  hate_speech: 'Discurso de odio',
  other: 'Otro',
};

export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed' | 'actioned';

export interface Report {
  id: string;
  reporter_id: string;
  dynamo_id?: string | null;
  reply_id?: string | null;
  reason: ReportReason;
  description?: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface ReportDTO {
  dynamoId?: string;
  replyId?: string;
  reason: ReportReason;
  description?: string;
}

export interface ModerationAction {
  id: string;
  target_user_id?: string;
  target_dynamo_id?: string;
  target_reply_id?: string;
  admin_id: string;
  action: string;
  reason?: string;
  created_at: string;
}
