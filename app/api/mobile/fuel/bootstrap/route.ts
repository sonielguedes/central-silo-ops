import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';
import { validateCompanyAccess } from '@/lib/subscription/subscription-validator';
import {
  handleFuelBootstrapRequest,
} from '@/lib/mobile/fuel-bootstrap-service';

export const dynamic = 'force-dynamic';

function formatSaoPauloIso(date = new Date()): string {
  const offsetMinutes = -180;
  const local = new Date(date.getTime() + offsetMinutes * 60_000);
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return local.toISOString().replace('Z', `${sign}${hh}:${mm}`);
}

function lookupCompanyByToken(token: string) {
  const raw = ServerStorage.getCompanyByToken(token);
  if (!raw) return undefined;
  return migrateCompanySubscription(raw).company;
}

function canUseCompany(company: { status?: string; tenantId: string }) {
  return validateCompanyAccess(company as never);
}

export async function GET(req: NextRequest) {
  const result = handleFuelBootstrapRequest({
    headers: req.headers,
    lookupCompanyByToken,
    canUseCompany,
    syncedAt: formatSaoPauloIso(new Date()),
  });

  if (result.status === 200) {
    console.info(
      '[FuelBootstrap] tenantId=%s companyCode=%s',
      result.body.tenantId,
      result.body.companyCode,
    );
    console.info(
      '[FuelBootstrap] fleets=%d drivers=%d operators=%d attendants=%d products=%d pumps=%d comboios=%d',
      result.body.fleets.length,
      result.body.drivers.length,
      result.body.operators.length,
      result.body.attendants.length,
      result.body.products.length,
      result.body.pumps.length,
      result.body.comboios.length,
    );
  }

  return NextResponse.json(result.body, { status: result.status });
}

export async function POST() {
  return NextResponse.json(
    { success: false, errorCode: 'METHOD_NOT_ALLOWED', message: 'Método não permitido.' },
    { status: 405, headers: { Allow: 'GET' } },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Company-Token, X-Tenant-Id, X-Company-Code, X-App-Module, X-App-Name',
    },
  });
}

