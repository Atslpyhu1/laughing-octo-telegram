import { Router, Request, Response } from 'express';
import { templateRegistry } from '../templates';
import { getSupabaseClient } from '../db/client';
import { logger } from '../index';

export const templatesRouter = Router();

/** List all registered message templates */
templatesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const agencyId = req.query.agency_id as string;

    // Return built-in templates from registry
    const builtIn = Object.values(templateRegistry).map((t) => ({
      name: t.name,
      category: t.category,
      language: t.language,
      variables: t.variables,
      source: 'built_in',
    }));

    // Also fetch custom templates from database if agency_id provided
    let custom: Array<Record<string, unknown>> = [];
    if (agencyId) {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      custom = (data ?? []).map((t) => ({ ...t, source: 'custom' }));
    }

    res.json({
      templates: [...builtIn, ...custom],
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list templates');
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

/** Get a specific template by name */
templatesRouter.get('/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const template = templateRegistry[name];

  if (!template) {
    res.status(404).json({ error: `Template '${name}' not found` });
    return;
  }

  res.json(template);
});
