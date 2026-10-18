import type { MetadataRoute } from 'next';

import { APP_DESCRIPTION, APP_NAME } from '@/lib/constants';

/** Web app manifest — lets riders and drivers "Add to Home Screen" for a native-like feel. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0a',
    theme_color: '#2563eb',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
