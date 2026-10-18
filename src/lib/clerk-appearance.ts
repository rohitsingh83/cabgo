import type { ClerkProvider } from '@clerk/nextjs';

/** Appearance type as accepted by <ClerkProvider> (avoids depending on @clerk/types directly). */
type Appearance = NonNullable<Parameters<typeof ClerkProvider>[0]['appearance']>;

/**
 * Clerk theme that follows CabGo's design tokens.
 *
 * Colours reference our CSS variables (`--card`, `--foreground`, `--brand` …), so Clerk's
 * components switch between light and dark automatically with the `.dark` class — no
 * client-side theme plumbing required and it works inside the server `ClerkProvider`.
 *
 * Utility classes in `elements` use Tailwind's `!` (important) modifier so they win over
 * Clerk's own injected styles.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: 'hsl(var(--brand))',
    colorBackground: 'hsl(var(--card))',
    colorText: 'hsl(var(--foreground))',
    colorTextSecondary: 'hsl(var(--muted-foreground))',
    colorInputBackground: 'hsl(var(--background))',
    colorInputText: 'hsl(var(--foreground))',
    colorDanger: 'hsl(var(--destructive))',
    colorSuccess: 'hsl(var(--success))',
    colorNeutral: 'hsl(var(--foreground))',
    fontFamily: 'var(--font-sans)',
    fontFamilyButtons: 'var(--font-sans)',
    borderRadius: '0.75rem',
    spacingUnit: '1rem',
  },
  elements: {
    rootBox: '!w-full',
    cardBox: '!w-full !shadow-none !border-0 !bg-transparent',
    card: '!w-full !shadow-none !border-0 !bg-transparent !p-0 !gap-6',
    header: '!text-left !items-start',
    headerTitle: '!text-2xl sm:!text-3xl !font-bold !tracking-tight',
    headerSubtitle: '!text-sm !text-muted-foreground',
    socialButtons: '!gap-3',
    socialButtonsBlockButton:
      '!h-11 !rounded-xl !border !border-input !bg-background hover:!bg-accent !transition-colors',
    socialButtonsBlockButtonText: '!font-semibold !text-sm',
    dividerLine: '!bg-border',
    dividerText: '!text-muted-foreground !text-xs !uppercase !tracking-wider',
    formFieldLabel: '!text-sm !font-medium',
    formFieldInput:
      '!h-11 !rounded-xl !border !border-input !bg-background !text-base md:!text-sm focus:!border-brand focus:!ring-2 focus:!ring-brand/30',
    formButtonPrimary:
      '!h-11 !rounded-xl !bg-brand-gradient !text-white !normal-case !text-sm !font-semibold !shadow-soft hover:!brightness-110 !transition active:!scale-[0.98]',
    footerActionText: '!text-muted-foreground',
    footerActionLink: '!text-brand !font-semibold hover:!underline',
    footer: '!bg-transparent',
    identityPreviewEditButton: '!text-brand',
    formResendCodeLink: '!text-brand',
    otpCodeFieldInput: '!rounded-xl !border-input',
    alert: '!rounded-xl',
    userButtonPopoverCard: '!rounded-2xl !border !border-border !shadow-lift',
    userButtonAvatarBox: '!h-9 !w-9',
  },
};
