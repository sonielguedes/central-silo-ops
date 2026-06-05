import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const company = await req.json() as Company;

    if (!company.id || !company.code) {
      return NextResponse.json({ error: 'company id/code is required' }, { status: 400 });
    }

    if (!company.companyToken) {
      return NextResponse.json({ error: 'companyToken is required' }, { status: 400 });
    }

    if (!company.apiPort) {
      return NextResponse.json({ error: 'apiPort is required' }, { status: 400 });
    }

    const saved = ServerStorage.upsertCompany(company);
    return NextResponse.json({
      companyId: saved.id,
      tenantId: saved.tenantId,
      apiPort: saved.apiPort,
      companyToken: saved.companyToken,
      status: saved.status,
    });
  } catch (error) {
    console.error('[mobile/company] failed to persist company', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
