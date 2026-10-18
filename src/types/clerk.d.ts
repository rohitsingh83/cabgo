import type { UserRole } from '@/types';

/**
 * Clerk type augmentation.
 *
 * `metadata` is exposed on the session token. In the Clerk Dashboard go to
 * Configure → Sessions → "Customize session token" and set the claims to:
 *
 *   { "metadata": "{{user.public_metadata}}" }
 *
 * With that in place the middleware can read the user's role and onboarding state
 * straight from the JWT — no database call on every request.
 */
declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: UserRole;
      onboardingComplete?: boolean;
    };
  }

  interface UserPublicMetadata {
    role?: UserRole;
    onboardingComplete?: boolean;
  }
}

export {};
