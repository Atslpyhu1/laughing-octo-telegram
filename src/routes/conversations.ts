import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSupabaseClient } from '../db/client';
import { logger } from '../index';

export const conversationsRouter = Router();

const listConversationsSchema = z.object({
  agency_id: z.string().uuid(),
  status: z.enum(['active', 'closed', 'pending_agent']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** List conversations with pagination */
conversationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const query = listConversationsSchema.parse(req.query);
    const supabase = getSupabaseClient();

    let dbQuery = supabase
      .from('whatsapp_conversations')
      .select(
        `
        *,
        whatsapp_contacts!inner(id, phone, name, role)
      `,
        { count: 'exact' },
      )
      .eq('agency_id', query.agency_id);

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    const offset = (query.page - 1) * query.limit;
    dbQuery = dbQuery
      .range(offset, offset + query.limit - 1)
      .order('started_at', { ascending: false });

    const { data, error, count } = await dbQuery;

    if (error) {
      logger.error({ error }, 'Failed to list conversations');
      res.status(500).json({ error: 'Failed to list conversations' });
      return;
    }

    res.json({
      conversations: data ?? [],
      total: count ?? 0,
      page: query.page,
      limit: query.limit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Get a single conversation with messages */
conversationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const supabase = getSupabaseClient();

    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('whatsapp_conversations')
      .select(
        `
        *,
        whatsapp_contacts!inner(id, phone, name, role, tags)
      `,
      )
      .eq('id', id)
      .eq('agency_id', agencyId)
      .single();

    if (convError) {
      if (convError.code === 'PGRST116') {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }
      throw convError;
    }

    // Get messages
    const messagesPage = Number(req.query.messages_page ?? 1);
    const messagesLimit = Math.min(Number(req.query.messages_limit ?? 50), 100);
    const messagesOffset = (messagesPage - 1) * messagesLimit;

    const { data: messages, error: msgError, count: messageCount } = await supabase
      .from('whatsapp_messages')
      .select('*', { count: 'exact' })
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .range(messagesOffset, messagesOffset + messagesLimit - 1);

    if (msgError) {
      throw msgError;
    }

    res.json({
      conversation,
      messages: messages ?? [],
      message_count: messageCount ?? 0,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get conversation');
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/** Close a conversation */
conversationsRouter.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id } = req.body;

    if (!agency_id) {
      res.status(400).json({ error: 'agency_id is required' });
      return;
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('agency_id', agency_id);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to close conversation');
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

/** Assign a conversation to an agent */
conversationsRouter.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id, assigned_to } = req.body;

    if (!agency_id || !assigned_to) {
      res.status(400).json({ error: 'agency_id and assigned_to are required' });
      return;
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({
        assigned_to,
        status: 'active',
      })
      .eq('id', id)
      .eq('agency_id', agency_id);

    if (error) {
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to assign conversation');
    res.status(500).json({ error: 'Failed to assign conversation' });
  }
});
