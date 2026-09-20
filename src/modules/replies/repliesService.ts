import { supabase, isSupabaseConfigured } from '@/src/lib/supabase';
import { Reply, CreateReplyDTO } from './repliesTypes';
import { Profile } from '../profiles/profilesTypes';
import { notificationsService } from '../notifications/notificationsService';
import { relationshipsService } from '../relationships/relationshipsService';

const LOCAL_STORAGE_REPLIES_KEY = 'dynamo_replies';
const LOCAL_STORAGE_DYNAMOS_KEY = 'dynamo_feed_records';

export const repliesService = {
  async getReplies(dynamoId: string): Promise<Reply[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('replies')
        .select('*, profiles:user_id (*)')
        .eq('dynamo_id', dynamoId)
        .neq('status', 'hidden')
        .order('created_at', { ascending: true });

      if (error) return [];
      return (data || []).map((r: any) => ({
        id: r.id,
        dynamo_id: r.dynamo_id,
        user_id: r.user_id,
        content: r.content,
        status: r.status || 'active',
        created_at: r.created_at,
        author: r.profiles,
      }));
    }

    const saved = localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY);
    const list: Reply[] = saved ? JSON.parse(saved) : [];
    return list.filter((r) => r.dynamo_id === dynamoId && r.status !== 'hidden');
  },

  async createReply(dto: CreateReplyDTO, author: Profile): Promise<Reply> {
    const trimmed = dto.content.trim().replace(/[<>]/g, '');
    if (!trimmed || trimmed.length > 280) {
      throw new Error('La respuesta debe tener entre 1 y 280 caracteres.');
    }

    if (isSupabaseConfigured) {
      // First verify that target dynamo is active & not expired & not hidden
      const { data: targetDynamo, error: checkError } = await supabase
        .from('dynamos')
        .select('id, user_id, expires_at, status')
        .eq('id', dto.dynamoId)
        .single();

      if (checkError || !targetDynamo) {
        throw new Error('El Dynamo no existe.');
      }

      if (
        targetDynamo.status !== 'active' ||
        targetDynamo.status === 'hidden' ||
        new Date(targetDynamo.expires_at).getTime() <= Date.now()
      ) {
        throw new Error('No se puede responder a un Dynamo expirado o inactivo por moderación.');
      }

      // Check bidirectional block with dynamo author
      if (targetDynamo.user_id && targetDynamo.user_id !== author.id) {
        const isBlocked = await relationshipsService.isBlockedBidirectional(author.id, targetDynamo.user_id);
        if (isBlocked) {
          throw new Error('No es posible responder debido a un bloqueo entre ambos usuarios.');
        }
      }

      const { data, error } = await supabase
        .from('replies')
        .insert({
          dynamo_id: dto.dynamoId,
          user_id: author.id,
          content: trimmed,
          status: 'active',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          throw new Error('No es posible responder a este Dynamo debido a restricciones de privacidad o bloqueos.');
        }
        throw new Error(error.message);
      }
      return {
        ...data,
        status: 'active',
        author,
      };
    }

    // Local fallback
    const rawDynamos = localStorage.getItem(LOCAL_STORAGE_DYNAMOS_KEY);
    const dynamos = rawDynamos ? JSON.parse(rawDynamos) : [];
    const target = dynamos.find((d: any) => d.id === dto.dynamoId);

    if (target) {
      if (
        target.status !== 'active' ||
        target.status === 'hidden' ||
        new Date(target.expires_at).getTime() <= Date.now()
      ) {
        throw new Error('No se puede responder a un Dynamo expirado u oculto por moderación.');
      }
      target.replies_count = (target.replies_count || 0) + 1;
      localStorage.setItem(LOCAL_STORAGE_DYNAMOS_KEY, JSON.stringify(dynamos));
    }

    const newReply: Reply = {
      id: 'rep_' + Math.random().toString(36).substring(2, 9),
      dynamo_id: dto.dynamoId,
      user_id: author.id,
      content: trimmed,
      status: 'active',
      created_at: new Date().toISOString(),
      author,
    };

    const saved = localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY);
    const list: Reply[] = saved ? JSON.parse(saved) : [];
    list.push(newReply);
    localStorage.setItem(LOCAL_STORAGE_REPLIES_KEY, JSON.stringify(list));

    // Emit notification to dynamo author if not replying to oneself
    if (target && target.user_id && target.user_id !== author.id) {
      notificationsService.createNotification({
        recipientId: target.user_id,
        type: 'reply',
        sender: author,
        referenceId: dto.dynamoId,
        metadata: { dynamo_id: dto.dynamoId, reply_id: newReply.id },
      }).catch(console.error);
    }

    return newReply;
  },
};
