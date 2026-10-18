import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@/lib/auth/clerk-client';
import '@fontsource-variable/plus-jakarta-sans';

import { Providers } from '@/components/providers/Providers';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/lib/constants';
import { clerkAppearance } from '@/lib/clerk-appearance';

import { DemoBar } from '@/components/shared/DemoBar';

import './globals.css';


const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  applicationName: APP_NAME,
  keywords: ['cab booking', 'ride hailing', 'taxi', 'auto', 'bike taxi', 'CabGo', 'Hyderabad'],
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      {/* suppressHydrationWarning: next-themes sets the `dark` class before hydration */}
      <html lang="en" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <Providers>
            {children}
            <DemoBar />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
