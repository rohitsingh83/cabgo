import type { NextFunction, Request, Response } from 'express';

import { createRateLimiter, type RateLimiter } from '../utils/rateLimit';

/** Express wrapper around the sliding-window limiter, keyed by client IP. */
export function httpRateLimit(options: { windowMs: number; max: number }): ((request: Request, response: Response, next: NextFunction) => void) & { limiter: RateLimiter } {
  const limiter = createRateLimiter(options);
  const middleware = (request: Request, response: Response, next: NextFunction): void => {
    if (!limiter.take(request.ip ?? 'unknown')) {
      response.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
      response.status(429).json({ success: false, error: 'Too many requests' });
      return;
    }
    next();
  };
  return Object.assign(middleware, { limiter });
}
