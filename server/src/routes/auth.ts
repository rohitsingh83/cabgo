import { Router } from 'express';

import type { Deps } from '../deps';

/**
 * POST /auth/firebase-token — exchanges a valid Clerk session token for a Firebase custom token
 * (uid = CabGo user id, claim `role`). The browser uses it to read live locations from the
 * Realtime Database as a fallback channel when Socket.IO is unavailable.
 */
export function createAuthRouter(deps: Deps): Router {
  const router = Router();

  router.post('/firebase-token', async (request, response, next) => {
    try {
      const header = request.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (!token) {
        response.status(401).json({ success: false, error: 'Missing bearer token' });
        return;
      }

      const user = await deps.authenticator.authenticate(token);
      if (!user) {
        response.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }
      if (!deps.liveStore.enabled) {
        response.status(503).json({ success: false, error: 'Firebase is not configured' });
        return;
      }

      const firebaseToken = await deps.liveStore.issueToken(user.id, user.role);
      if (!firebaseToken) {
        response.status(502).json({ success: false, error: 'Could not issue a Firebase token' });
        return;
      }
      response.json({ success: true, data: { token: firebaseToken } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
