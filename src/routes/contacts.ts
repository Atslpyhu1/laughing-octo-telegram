import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  contactService,
  createContactSchema,
  updateContactSchema,
  listContactsSchema,
} from '../crm/contacts';
import { importContactsFromCSV } from '../crm/import';
import { logger } from '../index';

export const contactsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

/** Create a new contact */
contactsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const input = createContactSchema.parse(req.body);
    const contact = await contactService.create(input);
    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to create contact');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create contact',
    });
  }
});

/** List contacts */
contactsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const input = listContactsSchema.parse(req.query);
    const result = await contactService.list(input);

    res.json({
      contacts: result.contacts,
      total: result.total,
      page: input.page,
      limit: input.limit,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to list contacts');
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

/** Get a single contact */
contactsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const contact = await contactService.getById(id, agencyId);

    if (!contact) {
      res.status(404).json({ error: 'Contact not found' });
      return;
    }

    res.json(contact);
  } catch (error) {
    logger.error({ error }, 'Failed to get contact');
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

/** Update a contact */
contactsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    const input = updateContactSchema.parse(req.body);
    const contact = await contactService.update(id, agencyId, input);

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    logger.error({ error }, 'Failed to update contact');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update contact',
    });
  }
});

/** Delete a contact */
contactsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agencyId = req.query.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id query parameter is required' });
      return;
    }

    await contactService.delete(id, agencyId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete contact');
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

/** Record opt-in (POPIA compliance) */
contactsRouter.post('/:id/opt-in', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id } = req.body;

    if (!agency_id) {
      res.status(400).json({ error: 'agency_id is required' });
      return;
    }

    await contactService.recordOptIn(id, agency_id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to record opt-in');
    res.status(500).json({ error: 'Failed to record opt-in' });
  }
});

/** Record opt-out (POPIA compliance) */
contactsRouter.post('/:id/opt-out', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id } = req.body;

    if (!agency_id) {
      res.status(400).json({ error: 'agency_id is required' });
      return;
    }

    await contactService.recordOptOut(id, agency_id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to record opt-out');
    res.status(500).json({ error: 'Failed to record opt-out' });
  }
});

/** Add tags to a contact */
contactsRouter.post('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id, tags } = req.body;

    if (!agency_id || !tags || !Array.isArray(tags)) {
      res.status(400).json({ error: 'agency_id and tags array are required' });
      return;
    }

    const contact = await contactService.addTags(id, agency_id, tags);
    res.json(contact);
  } catch (error) {
    logger.error({ error }, 'Failed to add tags');
    res.status(500).json({ error: 'Failed to add tags' });
  }
});

/** Remove tags from a contact */
contactsRouter.delete('/:id/tags', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agency_id, tags } = req.body;

    if (!agency_id || !tags || !Array.isArray(tags)) {
      res.status(400).json({ error: 'agency_id and tags array are required' });
      return;
    }

    const contact = await contactService.removeTags(id, agency_id, tags);
    res.json(contact);
  } catch (error) {
    logger.error({ error }, 'Failed to remove tags');
    res.status(500).json({ error: 'Failed to remove tags' });
  }
});

/** Import contacts from CSV */
contactsRouter.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const agencyId = req.body.agency_id as string;

    if (!agencyId) {
      res.status(400).json({ error: 'agency_id is required' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'CSV file is required' });
      return;
    }

    const result = await importContactsFromCSV(req.file.buffer, agencyId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to import contacts');
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to import contacts',
    });
  }
});
