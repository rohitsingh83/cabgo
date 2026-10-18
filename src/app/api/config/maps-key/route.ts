import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import { looksLikeGoogleKey } from '@/lib/google-maps/loader';

export const dynamic = 'force-dynamic';

const KEY_NAME = ['NEXT', 'PUBLIC', 'GOOGLE', 'MAPS', 'API', 'KEY'].join('_');
const SERVER_KEY_NAME = 'GOOGLE_MAPS_SERVER_API_KEY';

/**
 * GET /api/config/maps-key
 * Returns current configuration status and masked key preview.
 */
export async function GET() {
  const env = process.env as Record<string, string | undefined>;
  const currentKey = env[KEY_NAME] || env[SERVER_KEY_NAME] || '';

  const isConfigured = looksLikeGoogleKey(currentKey);
  const preview = isConfigured
    ? `${currentKey.slice(0, 8)}...${currentKey.slice(-4)}`
    : null;

  return NextResponse.json({
    configured: isConfigured,
    preview,
  });
}

/**
 * POST /api/config/maps-key
 * Updates the Google Maps API key in .env.local and runtime process.env.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';

    if (!looksLikeGoogleKey(apiKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Google Maps API Key format. A valid key starts with "AIza" and is at least 35 characters long.',
        },
        { status: 400 },
      );
    }

    // Update in-memory process environment dynamically
    const runtimeEnv = process.env as Record<string, string | undefined>;
    runtimeEnv[KEY_NAME] = apiKey;
    runtimeEnv[SERVER_KEY_NAME] = apiKey;

    // Persist to .env.local in project root
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');

      const pubPattern = new RegExp(`${KEY_NAME}=.*`, 'g');
      if (content.includes(`${KEY_NAME}=`)) {
        content = content.replace(pubPattern, `${KEY_NAME}=${apiKey}`);
      } else {
        content += `\n${KEY_NAME}=${apiKey}`;
      }

      const srvPattern = new RegExp(`${SERVER_KEY_NAME}=.*`, 'g');
      if (content.includes(`${SERVER_KEY_NAME}=`)) {
        content = content.replace(srvPattern, `${SERVER_KEY_NAME}=${apiKey}`);
      } else {
        content += `\n${SERVER_KEY_NAME}=${apiKey}`;
      }

      fs.writeFileSync(envPath, content, 'utf8');
    }

    return NextResponse.json({
      success: true,
      message: 'Google Maps API Key saved and activated successfully.',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
