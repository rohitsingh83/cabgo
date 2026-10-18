import type { Metadata } from 'next';
import { SignUp } from '@/lib/auth/clerk-client';
import { SignInCard } from '@/components/auth/SignInCard';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Join CabGo as a rider or a driver partner in under a minute.',
};

/**
 * Route for user registration.
 * In demo mode, renders the brand-new SignInCard with Google, phone OTP and remembered user.
 * In production with valid Clerk keys, renders Clerk's full registration component.
 */
export default function SignUpPage() {
  const isDemoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
    !process.env.CLERK_SECRET_KEY ||
    process.env.CLERK_SECRET_KEY === 'sk_test_REPLACE_ME' ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.includes('example.clerk.accounts.dev');

  if (isDemoMode) {
    return <SignInCard mode="sign-up" />;
  }

  return (
    <SignUp
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/onboarding"
    />
  );
}
