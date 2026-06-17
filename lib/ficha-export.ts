import {
  FichaStore,
  deriveFichaStatus,
  getEffectiveBlockingInconsistencies,
} from '@/lib/ficha-store';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';
import type { FichaOverlay } from '@/lib/ficha-store';

export type ExportFormat = 'csv' | 'txt';

export interface CanExportResult {
  ok: boolean;
  blockingReasons: string[];
  warnings: string[];
}

export const FICHA_EXPORT_COLUMNS = [
  'data',
  'periodo_inicio',
  'periodo_fim',
  'regional',
  'unidade',
  'grupo_equipamento',
  'frota',
  'tipo_equipamento',
  'operador',
  'matricula',
  'os',
  'operacao_codigo',
  'operacao_descricao',
  'centro_custo',
  'implemento_codigo',
  'implemento_descricao',
  'fazenda',
  'zona',
  'talhao',
  'horimetro_inicio',
  'horimetro_atual',
  'horimetro_fim',
  'total_horas',
  'horas_produtivas',
  'horas_paradas',
  'horas_indeterminado',
  'percentual_indeterminado',
  'status',
  'inconsistencias',
  'validado',
  'exportado',
  'validado_por',
  'validado_em',
  'exportado_em',
  'pims_instance',
  'pims_boletim',
  'pims_operation_date',
  'pims_equipment_code',
  'pims_operator_code',
  'pims_operation_code',
  'pims_cost_center_code',
  'pims_implement_code',
  'pims_farm_code',
  'pims_zone_code',
  'pims_field_code',
  'pims_export_status',
  'pims_exported_at',
  'pims_last_error',
] as const;

function esc(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[;\n\r"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function fmtBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function fmtMin(min: number | null | undefined): string {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + 'h' + (m > 0 ? String(m).padStart(2, '0') + 'min' : '');
}

function fmtH(v: number | null | undefined): string {
  if (v == null) return '';
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

export function canExportFicha(ficha: FichaDiaria, overlay: FichaOverlay | null): CanExportResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const blockingIncs = getEffectiveBlockingInconsistencies(ficha.inconsistencies, overlay);
  const hasBlockingInc = blockingIncs.length > 0;
  const finalStatus = deriveFichaStatus({
    computedStatus: ficha.status,
    overlay,
    isDayOpen: ficha.isDayOpen,
    hasBlockingInconsistency: hasBlockingInc,
  });

  if (finalStatus === 'EM_ANDAMENTO') {
    blockingReasons.push('Ficha ainda em andamento. Aguarde o fechamento da jornada ou do dia operacional.');
  }
  if (finalStatus === 'INCONSISTENTE' || hasBlockingInc) {
    blockingReasons.push('Inconsistências críticas: ' + blockingIncs.join(', '));
  }
  if (!ficha.fleetCode) blockingReasons.push('FROTA_NAO_IDENTIFICADA');
  if (!ficha.operatorName && !ficha.operatorRegistration) blockingReasons.push('OPERADOR_NAO_IDENTIFICADO');
  if (ficha.operatorRegistration != null && String(ficha.operatorRegistration).trim().length < 2) blockingReasons.push('MATRICULA_INVALIDA');
  if (!ficha.operationCode) blockingReasons.push('OPERACAO_NAO_INFORMADA');
  if (!ficha.workOrderNumber) blockingReasons.push('OS_NAO_INFORMADA');
  if (ficha.hourmeterStart == null) blockingReasons.push('SEM_HORIMETRO_INICIAL');
  if (ficha.hourmeterEnd != null && ficha.hourmeterStart != null && ficha.hourmeterEnd < ficha.hourmeterStart) blockingReasons.push('HORIMETRO_FINAL_MENOR_QUE_INICIAL');
  if (!ficha.isDayOpen && ficha.hourmeterEnd == null && ficha.hourmeterStart != null) blockingReasons.push('JOURNEY_END_SEM_HORIMETRO_FINAL');
  if (overlay?.needsReexport) warnings.push('Ficha alterada após exportação. Reexportação recomendada.');

  return { ok: blockingReasons.length === 0, blockingReasons, warnings };
}

export function buildFichaExportRow(ficha: FichaDiaria, overlay: FichaOverlay | null): string {
  const cf = overlay?.correctedFields ?? {};
  const get = (field: string, base: unknown): unknown => (field in cf ? cf[field] : base);
  const hasBlockingInc = getEffectiveBlockingInconsistencies(ficha.inconsistencies, overlay).length > 0;
  const finalStatus = deriveFichaStatus({
    computedStatus: ficha.status,
    overlay,
    isDayOpen: ficha.isDayOpen,
    hasBlockingInconsistency: hasBlockingInc,
  });
  const pims = overlay?.pims ?? {};
  const cells = [
    esc(ficha.date),
    esc(fmtBR(ficha.periodStart)),
    esc(fmtBR(ficha.periodEnd)),
    esc(''),
    esc(''),
    esc(''),
    esc(ficha.fleetCode),
    esc(''),
    esc(get('operatorName', ficha.operatorName)),
    esc(get('operatorRegistration', ficha.operatorRegistration)),
    esc(get('workOrderNumber', ficha.workOrderNumber)),
    esc(get('operationCode', ficha.operationCode)),
    esc(get('operationName', ficha.operationName)),
    esc(get('costCenterName', ficha.costCenterName)),
    esc(get('implementCode', ficha.implementCode)),
    esc(get('implementName', ficha.implementName)),
    esc(''),
    esc(''),
    esc(''),
    esc(fmtH(get('hourmeterStart', ficha.hourmeterStart) as number | null | undefined)),
    esc(fmtH(ficha.hourmeterCurrent)),
    esc(fmtH(get('hourmeterEnd', ficha.hourmeterEnd) as number | null | undefined)),
    esc(fmtH(ficha.totalHourmeter)),
    esc(fmtMin(ficha.minutesOperating)),
    esc(fmtMin(ficha.minutesStopped)),
    esc(fmtMin(ficha.minutesUndetermined)),
    esc(ficha.pctUndetermined != null ? String(ficha.pctUndetermined).replace('.', ',') + '%' : ''),
    esc(finalStatus),
    esc(ficha.inconsistencies.join(' | ')),
    esc(overlay?.validated ? 'SIM' : 'NAO'),
    esc(overlay?.exported ? 'SIM' : 'NAO'),
    esc(overlay?.validatedBy ?? ''),
    esc(fmtBR(overlay?.validatedAt)),
    esc(fmtBR(overlay?.exportedAt)),
    esc(pims.pimsInstance ?? ''),
    esc(pims.pimsBoletim ?? ''),
    esc(pims.pimsOperationDate ?? ''),
    esc(pims.pimsEquipmentCode ?? ''),
    esc(pims.pimsOperatorCode ?? ''),
    esc(pims.pimsOperationCode ?? ''),
    esc(pims.pimsCostCenterCode ?? ''),
    esc(pims.pimsImplementCode ?? ''),
    esc(pims.pimsFarmCode ?? ''),
    esc(pims.pimsZoneCode ?? ''),
    esc(pims.pimsFieldCode ?? ''),
    esc(pims.pimsExportStatus ?? ''),
    esc(fmtBR(pims.pimsExportedAt ?? null)),
    esc(pims.pimsLastError ?? ''),
  ];
  return cells.join(';');
}

export function buildFichaExportContent(fichas: FichaDiaria[], tenantId: string, format: ExportFormat): string {
  const rows = fichas.map(f => buildFichaExportRow(f, FichaStore.get(tenantId, f.fleetCode, f.date)));
  const body = [FICHA_EXPORT_COLUMNS.join(';'), ...rows].join('\n');
  return format === 'csv' ? '\uFEFF' + body : body;
}

export function resolveFichaExportFilename(date: string, format: ExportFormat): string {
  return 'ficha-operador-' + date + '.' + format;
}
