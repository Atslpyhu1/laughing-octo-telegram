import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { flowEngine } from '../flows/engine';
import { getSupabaseClient } from '../db/client';
import { logger } from '../index';

export const flowsRouter = Router();

/** Trigger an automated flow */
const triggerFlowSchema = z.object({
  contact_id: z.string().uuid(),
  agency_id: z.string().uuid(),
  context: z.record(z.unknown()).default({}),
});

flowsRouter.post('/:flowId/trigger', async (req: Request, res: Response) => {
  try {
    const { flowId } = req.params;
    const body = triggerFlowSchema.parse(req.body);

    const execution = await flowEngine.triggerFlow(
      flowId,
      body.contact_id,
      body.agency_id,
      body.context,
    );

    res.json({
      success: true,
      execution_id: execution.id,
      status: execution.status,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to trigger flow');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to trigger flow',
    });
  }
});

/** Resume a paused flow execution */
flowsRouter.post('/executions/:executionId/resume', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    await flowEngine.resumeExecution(executionId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to resume flow execution');
    res.status(500).json({ error: 'Failed to resume flow execution' });
  }
});

/** List automated flows */
flowsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('automated_flows')
      .select('*')
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ flows: data ?? [] });
  } catch (error) {
    logger.error({ error }, 'Failed to list flows');
    res.status(500).json({ error: 'Failed to list flows' });
  }
});

/** Get flow execution status */
flowsRouter.get('/executions/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('flow_executions')
      .select('*, automated_flows(name, trigger_type)')
      .eq('id', executionId)
      .eq('agency_id', agencyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    logger.error({ error }, 'Failed to get flow execution');
    res.status(500).json({ error: 'Failed to get flow execution' });
  }
});

/** List active flow executions for a contact */
flowsRouter.get('/contact/:contactId/executions', async (req: Request, res: Response) => {
  try {
    const { contactId } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('flow_executions')
      .select('*, automated_flows(name, trigger_type)')
      .eq('contact_id', contactId)
      .eq('agency_id', agencyId)
      .order('started_at', { ascending: false });

    if (error) throw error;

    res.json({ executions: data ?? [] });
  } catch (error) {
    logger.error({ error }, 'Failed to list contact flow executions');
    res.status(500).json({ error: 'Failed to list flow executions' });
  }
});
