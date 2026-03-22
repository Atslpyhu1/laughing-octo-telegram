import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../index';

/**
 * API key authentication middleware.
 * Accepts either:
 * - X-API-Key header with a valid API key
 * - Authorization: Bearer <JWT> header with a valid JWT
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  // Check API key
  if (apiKey && apiKey === config.API_KEY) {
    next();
    return;
  }

  // Check JWT Bearer token
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      (req as any).user = decoded;
      next();
      return;
    } catch (error) {
      logger.warn({ error }, 'Invalid JWT token');
    }
  }

  res.status(401).json({ error: 'Unauthorized — provide a valid X-API-Key or Bearer token' });
}

/**
 * Extracts agency_id from the authenticated request.
 * For JWT auth, the agency_id is in the token payload.
 * For API key auth, it must be provided in the request body/query.
 */
export function getAgencyId(req: Request): string | undefined {
  const user = (req as any).user;
  if (user?.agency_id) return user.agency_id;
  return (req.body?.agency_id ?? req.query?.agency_id) as string | undefined;
}
