import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private, authenticated areas should never be indexed.
        disallow: ['/api/', '/rider', '/driver', '/admin', '/onboarding', '/suspended'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
