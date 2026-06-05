import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'silo-ops-mobile-api',
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    timestamp: new Date().toISOString(),
  });
}
