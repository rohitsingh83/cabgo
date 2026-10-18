import { createHash, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Constant-time string comparison (hashing first makes the buffers equal length). */
function safeEqual(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest();
  const right = createHash('sha256').update(b).digest();
  return timingSafeEqual(left, right);
}

/**
 * Guards `/realtime/*`: only the Next.js backend (which knows the shared secret) may push events.
 * Browsers never call these endpoints.
 */
export function requireInternalSecret(secret: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const provided = request.header('x-internal-secret');
    if (!provided || !safeEqual(provided, secret)) {
      response.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    next();
  };
}
