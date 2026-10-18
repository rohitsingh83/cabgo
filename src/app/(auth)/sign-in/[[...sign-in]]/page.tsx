import type { Metadata } from 'next';
import { SignIn } from '@/lib/auth/clerk-client';
import { SignInCard } from '@/components/auth/SignInCard';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to CabGo to book rides, track your driver and manage payments.',
};

/**
 * Catch-all route for authentication.
 * In demo mode, renders the brand-new SignInCard with Google, phone OTP and remembered user.
 * In production with valid Clerk keys, renders Clerk's full authentication component.
 */
export default function SignInPage() {
  const isDemoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === 'sk_test_REPLACE_ME' ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes('example.clerk.accounts.dev');

  if (isDemoMode) {
    return <SignInCard mode="sign-in" />;
  }

  return (
    <SignIn
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/onboarding"
    />
  );
}
