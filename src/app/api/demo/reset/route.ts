import { NextResponse } from 'next/server';
import { resetDemoDb } from '@/lib/demo/mock-db';

export const dynamic = 'force-dynamic';

export async function POST() {
  resetDemoDb();
  return NextResponse.json({
    success: true,
    message: 'Demo database has been reset to original seed state',
  });
}
