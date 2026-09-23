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
        .select(`
          id,
          dynamo_id,
          user_id,
          content,
          parent_reply_id,
          status,
          created_at,
          profiles:user_id (id, username, avatar, bio, status, created_at)
        `)
        .eq('dynamo_id', dynamoId)
        .neq('status', 'hidden')
        .order('created_at', { ascending: true });

      if (error) return [];
      return (data || []).map((r: any) => ({
        id: r.id,
        dynamo_id: r.dynamo_id,
        user_id: r.user_id,
        content: r.content,
        parent_reply_id: r.parent_reply_id || null,
        status: r.status || 'active',
        created_at: r.created_at,
        author: r.profiles,
      }));
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      return [];
    }

    const saved = localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY);
    const list: Reply[] = saved ? JSON.parse(saved) : [];
    return list
      .filter((r) => r.dynamo_id === dynamoId && r.status !== 'hidden')
      .map((r) => ({
        ...r,
        parent_reply_id: r.parent_reply_id || null,
      }));
  },

  async createReply(dto: CreateReplyDTO, author: Profile): Promise<Reply> {
    const trimmed = dto.content.trim().replace(/[<>]/g, '');
    if (!trimmed || trimmed.length > 280) {
      throw new Error('La respuesta debe tener entre 1 y 280 caracteres.');
    }

    let finalParentReplyId: string | null = null;

    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && !user.email_confirmed_at && !(user as any).confirmed_at) {
        throw new Error('Confirma tu correo para activar tu cuenta de Dynamo antes de responder.');
      }

      // 1. Verify target dynamo is active & not expired & not hidden
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
        const isBlockedWithDynamoAuthor = await relationshipsService.isBlockedBidirectional(
          author.id,
          targetDynamo.user_id
        );
        if (isBlockedWithDynamoAuthor) {
          throw new Error('No es posible responder debido a un bloqueo entre ambos usuarios.');
        }
      }

      // 2. Validate reply context: Direct Dynamo reply vs Reply-to-reply
      if (dto.parentReplyId) {
        // Fetch parent reply to validate belonging, status, and avoid depth > 2
        const { data: parentReply, error: parentError } = await supabase
          .from('replies')
          .select('id, dynamo_id, user_id, status, parent_reply_id')
          .eq('id', dto.parentReplyId)
          .single();

        if (parentError || !parentReply) {
          throw new Error('El comentario al que intentas responder no existe.');
        }

        if (parentReply.dynamo_id !== dto.dynamoId) {
          throw new Error('La respuesta no pertenece al mismo Dynamo.');
        }

        if (parentReply.status !== 'active') {
          throw new Error('No se puede responder a un comentario moderado o inactivo.');
        }

        if (parentReply.user_id === author.id) {
          throw new Error('No puedes responder a tu propio comentario.');
        }

        // Check bidirectional block with parent comment author
        const isBlockedWithParentAuthor = await relationshipsService.isBlockedBidirectional(
          author.id,
          parentReply.user_id
        );
        if (isBlockedWithParentAuthor) {
          throw new Error('No es posible interactuar con este usuario debido a bloqueos.');
        }

        // STRICT 2-LEVEL DEPTH CAP:
        // If parent reply already has a parent_reply_id (i.e. is Level 2),
        // fold to its root Level 1 parent so new reply remains at Level 2.
        finalParentReplyId = parentReply.parent_reply_id || parentReply.id;
      } else {
        // Direct reply to Dynamo: Dynamo author cannot reply to own Dynamo
        if (targetDynamo.user_id === author.id) {
          throw new Error('No puedes responder directamente a tu propio Dynamo.');
        }
      }

      const { data, error } = await supabase
        .from('replies')
        .insert({
          dynamo_id: dto.dynamoId,
          user_id: author.id,
          content: trimmed,
          parent_reply_id: finalParentReplyId,
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
        parent_reply_id: data.parent_reply_id || finalParentReplyId,
        status: 'active',
        author,
      };
    }

    if (import.meta.env.PROD || isSupabaseConfigured) {
      throw new Error('Estamos teniendo problemas de conexión. Inténtalo nuevamente.');
    }

    // Local fallback (development only)
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

    const saved = localStorage.getItem(LOCAL_STORAGE_REPLIES_KEY);
    const list: Reply[] = saved ? JSON.parse(saved) : [];

    let parentReply: Reply | undefined;
    if (dto.parentReplyId) {
      parentReply = list.find((r) => r.id === dto.parentReplyId);
      if (!parentReply) {
        throw new Error('El comentario al que intentas responder no existe.');
      }
      if (parentReply.user_id === author.id) {
        throw new Error('No puedes responder a tu propio comentario.');
      }
      finalParentReplyId = parentReply.parent_reply_id || parentReply.id;
    } else {
      if (target && target.user_id === author.id) {
        throw new Error('No puedes responder directamente a tu propio Dynamo.');
      }
    }

    const newReply: Reply = {
      id: 'rep_' + Math.random().toString(36).substring(2, 9),
      dynamo_id: dto.dynamoId,
      user_id: author.id,
      content: trimmed,
      parent_reply_id: finalParentReplyId,
      status: 'active',
      created_at: new Date().toISOString(),
      author,
    };

    list.push(newReply);
    localStorage.setItem(LOCAL_STORAGE_REPLIES_KEY, JSON.stringify(list));

    // Emit exactly ONE notification to the relevant recipient:
    // If reply-to-reply: Notify author of the parent reply
    // If direct reply: Notify author of the Dynamo
    if (finalParentReplyId && parentReply) {
      if (parentReply.user_id && parentReply.user_id !== author.id) {
        notificationsService.createNotification({
          recipientId: parentReply.user_id,
          type: 'reply',
          sender: author,
          referenceId: dto.dynamoId,
          metadata: {
            dynamo_id: dto.dynamoId,
            reply_id: newReply.id,
            parent_reply_id: finalParentReplyId,
            target_type: 'reply',
          },
        }).catch(console.error);
      }
    } else if (target && target.user_id && target.user_id !== author.id) {
      notificationsService.createNotification({
        recipientId: target.user_id,
        type: 'reply',
        sender: author,
        referenceId: dto.dynamoId,
        metadata: {
          dynamo_id: dto.dynamoId,
          reply_id: newReply.id,
          target_type: 'dynamo',
        },
      }).catch(console.error);
    }

    return newReply;
  },
};
