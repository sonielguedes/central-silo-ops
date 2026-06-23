import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';

// ── Status normalisation ───────────────────────────────────────────────────────
// Cadastro records use entityStatus ('ATIVO' | 'INATIVO' | 'ARQUIVADO') for
// lifecycle and an operational `status` field that can be 'trabalhando',
// 'parada', 'ativo', etc. For mobile access we only care about the lifecycle
// status and mobileEnabled — a machine that is 'trabalhando' is actively in
// use and must not be blocked.

const INACTIVE_ENTITY_STATUSES = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado']);

function isCadastroEquipmentBlocked(item: Record<string, unknown>): boolean {
  const entityStatus = String(item.entityStatus ?? 'ATIVO');
  return INACTIVE_ENTITY_STATUSES.has(entityStatus);
}

function normalizeMobileEnabled(item: Record<string, unknown>): boolean {
  // Accept both `mobileEnabled` (Equipment interface) and `mobile` (form alias)
  if (typeof item.mobileEnabled === 'boolean') return item.mobileEnabled;
  if (typeof item.mobile === 'boolean') return item.mobile;
  // String representations saved by older form versions
  if (item.mobileEnabled === 'true' || item.mobile === 'true') return true;
  if (item.mobileEnabled === 'false' || item.mobile === 'false') return false;
  return false; // default to disabled (fail-safe)
}

// ── GET /api/mobile/equipment/lookup?fleetCode=<code> ─────────────────────────
// Lookup order:
//   1. PRIMARY  — cadastro-equipamentos.json (managed by Central UI)
//   2. FALLBACK — equipments.json (legacy, read-only, no auto-migration)
//
// tenantId comes exclusively from the validated X-Company-Token (requireMobileAuth).
// No client-supplied tenantId is ever trusted.

export async function GET(req: NextRequest) {
  const auth = requireMobileAuth(req);
  if (!auth.ok) return auth.response;

  const { tenantId } = auth;
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');

  if (!fleetCode || !fleetCode.trim()) {
    return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
  }

  const normalizedCode = fleetCode.trim().toLowerCase();

  // ── 1. PRIMARY: cadastro-equipamentos.json ──────────────────────────────────
  // CadastroStorage.getAll already filters out entityStatus=ARQUIVADO and
  // deletedAt records, so all returned items are lifecycle-active.
  CadastroStorage.ensureEquipmentMobileTokens(tenantId);
  const cadastroItems = CadastroStorage.getAll(tenantId, 'equipamentos') as Record<string, unknown>[];

  const cadastroMatch = cadastroItems.find(
    (item) => String(item.code ?? '').trim().toLowerCase() === normalizedCode,
  );

  if (cadastroMatch) {
    // Explicit INATIVO block (ARQUIVADO already filtered by getAll)
    if (isCadastroEquipmentBlocked(cadastroMatch)) {
      console.info('[mobile/equipment/lookup] cadastro: frota inativa', {
        tenantId,
        fleetCode,
        entityStatus: cadastroMatch.entityStatus,
      });
      return NextResponse.json({ error: 'Frota inativa.' }, { status: 403 });
    }

    const mobileEnabled = normalizeMobileEnabled(cadastroMatch);
    if (!mobileEnabled) {
      console.info('[mobile/equipment/lookup] cadastro: mobile desabilitado', {
        tenantId,
        fleetCode,
      });
      return NextResponse.json(
        { error: 'Mobile desabilitado para esta frota.' },
        { status: 403 },
      );
    }

    const brand = String(
      cadastroMatch.fabricante ?? cadastroMatch.brand ?? '',
    ).trim();

    console.info('[mobile/equipment/lookup] cadastro: found', {
      tenantId,
      fleetCode,
      id: cadastroMatch.id,
      mobileEnabled,
    });

    return NextResponse.json({
      id:           String(cadastroMatch.id ?? ''),
      code:         String(cadastroMatch.code ?? ''),
      name:         brand ? brand + ' ' + cadastroMatch.code : String(cadastroMatch.code ?? ''),
      active:       true,
      mobileEnabled: true,
      mobileToken:  (cadastroMatch.mobileToken as string | undefined) ?? null,
      tenantId,
    });
  }

  // ── 2. FALLBACK: equipments.json (legacy, read-only) ───────────────────────
  // This path exists for tenants that pre-date the Central cadastro and have
  // equipment stored only in the legacy equipments.json file. No records are
  // copied or migrated automatically.
  const legacy = ServerStorage.getEquipmentByFleetCode(fleetCode.trim(), tenantId);

  console.info('[mobile/equipment/lookup] equipment validation', {
    tenantId,
    fleetCode,
    source:      legacy ? 'legacy' : 'not-found',
    mobileEnabled: legacy?.mobileEnabled,
    status:      legacy?.status,
  });

  if (!legacy) {
    return NextResponse.json({ error: 'Frota nao cadastrada.' }, { status: 404 });
  }

  const validation = ServerStorage.validateMobileLookupEquipment(legacy, tenantId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  return NextResponse.json({
    id:           legacy.id,
    code:         legacy.code,
    name:         legacy.brand + ' ' + legacy.code,
    active:       legacy.entityStatus === 'ATIVO',
    mobileEnabled: legacy.mobileEnabled,
    mobileToken:  legacy.mobileToken,
    tenantId,
  });
}

export async function POST() { return handleMethodNotAllowed(); }
export async function PUT() { return handleMethodNotAllowed(); }
export async function DELETE() { return handleMethodNotAllowed(); }
export async function PATCH() { return handleMethodNotAllowed(); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Company-Token, X-Tenant-Id',
    },
  });
}

function handleMethodNotAllowed() {
  return NextResponse.json({ error: 'Metodo nao permitido para este endpoint mobile.' }, { status: 405 });
}
