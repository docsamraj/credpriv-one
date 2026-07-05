import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@credpriv/shared';
import { authenticate } from './auth';
import { AppError } from '../utils/response';

/** Security headers — lightweight alternative without extra deps */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-XSS-Protection', '0');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory rate limiter for auth endpoints */
export function rateLimit(opts: { windowMs: number; max: number; keyPrefix?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${opts.keyPrefix || 'rl'}:${ip}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    if (entry.count >= opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new AppError(429, 'Too many requests — please try again later'));
    }

    entry.count += 1;
    next();
  };
}

/** JWT or integration API key for machine-to-machine exports */
export function integrationAuth(req: Request, res: Response, next: NextFunction) {
  const configuredKey = process.env.INTEGRATION_API_KEY;
  const provided = req.headers['x-api-key'];

  if (configuredKey && typeof provided === 'string' && provided === configuredKey) {
    req.user = {
      userId: 'integration-service',
      email: 'integration@credpriv.system',
      roles: [UserRole.SYSTEM_ADMIN],
    };
    return next();
  }

  return authenticate(req, res, next);
}

/** Legacy helper — prefer integrationAuth on integration routes */
export function requireIntegrationApiKey(req: Request, _res: Response, next: NextFunction) {
  if (req.user) return next();
  return next(new AppError(401, 'Valid JWT or X-API-Key required for integration access'));
}
