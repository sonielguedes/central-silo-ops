import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import { IntegrationExportStorage } from '@/lib/integrations/integration-export-storage';
import { buildOperationalPackage, generateIntegrationExport, toCsv } from '@/lib/integrations/integration-export-generator';
import type { ExportDataType, ExportFormat, ExportTargetSystem, IntegrationExportFilters } from '@/lib/integrations/integration-export-types';
import type { IntegrationSystem } from '@/lib/integrations/integration-job-types';
import { getExportFolder, resolveSafeExportPath, writeTextFile, fileSize } from '@/lib/integrations/integration-export-files';

export const dynamic = 'force-dynamic';

const TARGETS = new Set<ExportTargetSystem>(['SILO', 'PIMS', 'TOTVS', 'POWER_BI', 'API_EXTERNA']);
const TYPES = new Set<ExportDataType>([
  'FICHA_OPERADOR',
  'JOURNEYS',
  'STOP_EVENTS',
  'HOURMETERS',
  'FUELINGS',
  'EQUIPMENTS',
  'OPERATORS',
  'OPERATIONS',
  'COST_CENTERS',
  'IMPLEMENTS',
  'FULL_OPERATIONAL_PACKAGE',
]);
const FORMATS = new Set<ExportFormat>(['JSON', 'CSV', 'ZIP']);

function toIntegrationSystem(targetSystem: ExportTargetSystem): IntegrationSystem {
  if (targetSystem === 'SILO' || targetSystem === 'POWER_BI') return 'EXPORTACAO';
  return targetSystem;
}

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function actor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

function asStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function parseBody(input: unknown): {
  targetSystem?: ExportTargetSystem;
  dataType?: ExportDataType;
  format?: ExportFormat;
  title?: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  filters?: IntegrationExportFilters;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload invalido');
  const body = input as Record<string, unknown>;
  const filters = body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
    ? (body.filters as Record<string, unknown>)
    : undefined;
  return {
    targetSystem: asStr(body.targetSystem)?.toUpperCase() as ExportTargetSystem | undefined,
    dataType: asStr(body.dataType)?.toUpperCase() as ExportDataType | undefined,
    format: asStr(body.format)?.toUpperCase() as ExportFormat | undefined,
    title: asStr(body.title),
    description: asStr(body.description),
    periodStart: asStr(body.periodStart),
    periodEnd: asStr(body.periodEnd),
    filters: filters ? {
      fleetCode: asStr(filters.fleetCode),
      operatorRegistration: asStr(filters.operatorRegistration),
      journeyId: asStr(filters.journeyId),
      operationCode: asStr(filters.operationCode),
      costCenterCode: asStr(filters.costCenterCode),
    } : undefined,
  };
}

function fileNameFor(format: ExportFormat, dataType: ExportDataType, exportId: string) {
  const suffix = format === 'JSON' ? 'json' : 'csv';
  const safe = `${dataType}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `export-${safe}-${exportId}.${suffix}`;
}

function writeExportFile(params: {
  tenantId: string;
  exportId: string;
  fileName: string;
  format: ExportFormat;
  dataType: ExportDataType;
  records: ReturnType<typeof generateIntegrationExport>['records'];
  targetSystem: ExportTargetSystem;
  periodStart?: string;
  periodEnd?: string;
  filters?: IntegrationExportFilters;
}) {
  const folder = getExportFolder(params.tenantId, params.exportId);
  const filePath = resolveSafeExportPath(params.tenantId, params.exportId, params.fileName);
  if (params.format === 'JSON') {
    const pkg = buildOperationalPackage({
      tenantId: params.tenantId,
      exportId: params.exportId,
      targetSystem: params.targetSystem,
      dataType: params.dataType,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      filters: params.filters,
      records: params.records,
    });
    writeTextFile(filePath, JSON.stringify(pkg, null, 2));
  } else {
    writeTextFile(filePath, toCsv(params.records, params.dataType));
  }
  return { folder, filePath, fileSizeBytes: fileSize(filePath) };
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const sp = req.nextUrl.searchParams;
  const items = IntegrationExportStorage.listByTenant(tenant.tenantId, {
    targetSystem: (sp.get('targetSystem')?.trim().toUpperCase() || undefined) as ExportTargetSystem | undefined,
    dataType: (sp.get('dataType')?.trim().toUpperCase() || undefined) as ExportDataType | undefined,
    format: (sp.get('format')?.trim().toUpperCase() || undefined) as ExportFormat | undefined,
    status: (sp.get('status')?.trim().toUpperCase() || undefined) as never,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
    q: sp.get('q')?.trim() || undefined,
  });
  return NextResponse.json({ success: true, items, total: items.length });
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (perm) return perm;

  try {
    const body = parseBody(await req.json());
    if (!body.targetSystem || !TARGETS.has(body.targetSystem)) return fail(400, 'Destino obrigatorio');
    if (!body.dataType || !TYPES.has(body.dataType)) return fail(400, 'Tipo de dado obrigatorio');
    if (!body.format || !FORMATS.has(body.format)) return fail(400, 'Formato obrigatorio');
    if (!body.title) return fail(400, 'Titulo obrigatorio');
    if (body.periodStart && body.periodEnd && body.periodStart > body.periodEnd) {
      return fail(400, 'Data inicial deve ser menor ou igual a data final');
    }
    if (body.format === 'ZIP') {
      return fail(422, 'ZIP sera liberado em etapa futura.');
    }

    const system = toIntegrationSystem(body.targetSystem);
    const exportRecord = IntegrationExportStorage.create({
      tenantId: tenant.tenantId,
      targetSystem: body.targetSystem,
      dataType: body.dataType,
      format: body.format,
      title: body.title,
      description: body.description,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      filters: body.filters,
      status: 'PENDING',
      createdBy: actor(req),
    });

    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system,
      level: 'INFO',
      event: 'EXPORT_CREATED',
      message: 'Exportacao criada.',
      createdBy: actor(req),
      metadata: { exportId: exportRecord.id, dataType: body.dataType, format: body.format },
    });

    const job = IntegrationJobStorage.create({
      tenantId: tenant.tenantId,
      system,
      type: 'MANUAL',
      title: body.title,
      description: body.description,
      maxAttempts: 3,
      source: 'API',
      createdBy: actor(req),
      payload: {
        exportId: exportRecord.id,
        dataType: body.dataType,
        format: body.format,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        filters: body.filters ?? {},
      },
    });

    IntegrationExportStorage.update(tenant.tenantId, exportRecord.id, { jobId: job.id });
    IntegrationJobStorage.setRunning(tenant.tenantId, job.id, actor(req));
    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system,
      level: 'INFO',
      event: 'EXPORT_STARTED',
      message: 'Processamento de exportacao iniciado.',
      jobId: job.id,
      createdBy: actor(req),
      metadata: { exportId: exportRecord.id },
    });

    try {
      const generated = generateIntegrationExport({
        tenantId: tenant.tenantId,
        exportId: exportRecord.id,
        targetSystem: body.targetSystem,
        dataType: body.dataType,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        filters: body.filters,
      });

      const fileName = fileNameFor(body.format, body.dataType, exportRecord.id);
      const { filePath, fileSizeBytes } = writeExportFile({
        tenantId: tenant.tenantId,
        exportId: exportRecord.id,
        fileName,
        format: body.format,
        dataType: body.dataType,
        records: generated.records,
        targetSystem: body.targetSystem,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        filters: body.filters,
      });

      IntegrationLogStorage.create({
        tenantId: tenant.tenantId,
        system,
        level: 'INFO',
        event: 'EXPORT_FILE_GENERATED',
        message: generated.emptyMessage || 'Arquivo de exportacao gerado.',
        jobId: job.id,
        createdBy: actor(req),
        metadata: { exportId: exportRecord.id, recordCount: generated.recordCount, fileName },
      });

      const finalExport = IntegrationExportStorage.setStatus(tenant.tenantId, exportRecord.id, 'SUCCESS', {
        filePath: `exports/${exportRecord.id}/${fileName}`,
        fileName,
        fileSizeBytes,
        recordCount: generated.recordCount,
        finishedAt: new Date().toISOString(),
        errorMessage: undefined,
      }) ?? exportRecord;

      IntegrationJobStorage.setSuccess(tenant.tenantId, job.id, {
        exportId: exportRecord.id,
        fileName,
        fileSizeBytes,
        recordCount: generated.recordCount,
      }, actor(req));

      IntegrationLogStorage.create({
        tenantId: tenant.tenantId,
        system,
        level: 'INFO',
        event: 'EXPORT_SUCCESS',
        message: 'Exportacao concluida com sucesso.',
        jobId: job.id,
        createdBy: actor(req),
        metadata: { exportId: exportRecord.id, filePath, recordCount: generated.recordCount },
      });

      return NextResponse.json({ success: true, item: finalExport }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar exportacao';
      IntegrationExportStorage.setStatus(tenant.tenantId, exportRecord.id, 'FAILED', {
        errorMessage: message,
        finishedAt: new Date().toISOString(),
      });
      IntegrationJobStorage.setFailed(tenant.tenantId, job.id, 'EXPORT_FAILED', message, actor(req));
      IntegrationLogStorage.create({
        tenantId: tenant.tenantId,
        system,
        level: 'ERROR',
        event: 'EXPORT_FAILED',
        message,
        jobId: job.id,
        createdBy: actor(req),
        metadata: { exportId: exportRecord.id },
      });
      return fail(500, message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}
