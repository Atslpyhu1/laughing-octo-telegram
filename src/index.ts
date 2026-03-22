import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';
import { config } from './config';
import { webhookRouter } from './webhook/handler';
import { sendRouter } from './routes/send';
import { conversationsRouter } from './routes/conversations';
import { noticesRouter } from './routes/notices';
import { contactsRouter } from './routes/contacts';
import { flowsRouter } from './routes/flows';
import { templatesRouter } from './routes/templates';
import { apiKeyAuth } from './middleware/auth';
import { apiRateLimiter } from './middleware/rate-limit';

export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Global middleware
app.use(helmet());
app.use(cors());

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'propassure-whatsapp-engine', timestamp: new Date().toISOString() });
});

// WhatsApp webhook — uses its own verification, no API key auth
// Must parse raw body for signature verification
app.use(
  '/webhook',
  express.raw({ type: 'application/json' }),
  webhookRouter,
);

// API routes — all require API key and rate limiting
app.use(express.json({ limit: '5mb' }));
app.use('/api', apiKeyAuth, apiRateLimiter);

app.use('/api/send', sendRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/notices', noticesRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/flows', flowsRouter);
app.use('/api/templates', templatesRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.PORT, () => {
  logger.info(`ProPassure WhatsApp Engine listening on port ${config.PORT}`);
});

export default app;
