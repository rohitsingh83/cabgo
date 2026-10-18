import type { NextFunction, Request, Response } from 'express';

import type { Logger } from '../lib/logger';

export function notFoundHandler(_request: Request, response: Response): void {
  response.status(404).json({ success: false, error: 'Not found' });
}

/** Last-resort error handler: log details server-side, return a generic message. */
export function createErrorHandler(logger: Logger) {
  return (error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    // body-parser errors carry a status (e.g. 400 invalid JSON, 413 payload too large).
    const status =
      typeof error === 'object' && error !== null && 'status' in error && typeof (error as { status: unknown }).status === 'number'
        ? (error as { status: number }).status
        : 500;
    if (status >= 500) {
      logger.error('unhandled request error', { path: request.path, error: error instanceof Error ? error.message : String(error) });
    }
    response.status(status).json({ success: false, error: status >= 500 ? 'Internal server error' : 'Bad request' });
  };
}
