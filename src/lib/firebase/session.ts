import { SOCKET_URL } from '@/lib/constants';
import { ensureFirebaseAuth } from '@/lib/firebase/realtime';
import { isFirebaseConfigured } from '@/lib/firebase/config';

/**
 * Sign the browser into Firebase using a custom token minted by the realtime server
 * (which verifies the caller's Clerk session first). Resolves to false when Firebase isn't set up
 * or the exchange fails — callers then simply keep polling.
 */
export async function signInToFirebase(getClerkToken: () => Promise<string | null>): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  try {
    const clerkToken = await getClerkToken();
    if (!clerkToken) return false;

    const response = await fetch(`${SOCKET_URL}/auth/firebase-token`, {
      method: 'POST',
      headers: { authorization: `Bearer ${clerkToken}` },
    });
    if (!response.ok) return false;

    const body = (await response.json()) as { success: boolean; data?: { token?: string } };
    const token = body.data?.token;
    if (!body.success || !token) return false;

    await ensureFirebaseAuth(token);
    return true;
  } catch {
    return false;
  }
}
