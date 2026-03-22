import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { sendSection8SevenDayNotice, sendSection8TwentyDayNotice, section8SevenDaySchema } from '../notices/section8';
import { sendPIEEvictionNotice, pieEvictionSchema } from '../notices/pie-act';
import { noticeTracker } from '../notices/tracker';
import { logger } from '../index';

export const noticesRouter = Router();

/** Generate and send a Section 8(1) 7-day notice */
noticesRouter.post('/section8-7day', async (req: Request, res: Response) => {
  try {
    const input = section8SevenDaySchema.parse(req.body);
    const result = await sendSection8SevenDayNotice(input);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to generate Section 8(1) 7-day notice');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate notice',
    });
  }
});

/** Generate and send a Section 8(1)(a) 20 business day notice */
noticesRouter.post('/section8-20day', async (req: Request, res: Response) => {
  try {
    const input = section8SevenDaySchema.parse(req.body);
    const result = await sendSection8TwentyDayNotice(input);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to generate Section 8(1)(a) 20-day notice');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate notice',
    });
  }
});

/** Generate and send a PIE Act eviction notice */
noticesRouter.post('/pie-eviction', async (req: Request, res: Response) => {
  try {
    const input = pieEvictionSchema.parse(req.body);
    const result = await sendPIEEvictionNotice(input);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to generate PIE Act eviction notice');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate notice',
    });
  }
});

/** Get delivery status for a notice */
noticesRouter.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const delivery = await noticeTracker.getDeliveryStatus(id, agencyId);

    if (!delivery) {
      res.status(404).json({ error: 'Notice delivery not found' });
      return;
    }

    res.json(delivery);
  } catch (error) {
    logger.error({ error }, 'Failed to get notice status');
    res.status(500).json({ error: 'Failed to get notice status' });
  }
});

/** Get all notices for a tenant (evidence trail) */
noticesRouter.get('/tenant/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const notices = await noticeTracker.getTenantNotices(tenantId, agencyId);

    res.json({ notices });
  } catch (error) {
    logger.error({ error }, 'Failed to get tenant notices');
    res.status(500).json({ error: 'Failed to get tenant notices' });
  }
});

/** Generate evidence report for a tenant */
noticesRouter.get('/tenant/:tenantId/evidence', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const report = await noticeTracker.generateEvidenceReport(tenantId, agencyId);

    res.json(report);
  } catch (error) {
    logger.error({ error }, 'Failed to generate evidence report');
    res.status(500).json({ error: 'Failed to generate evidence report' });
  }
});
