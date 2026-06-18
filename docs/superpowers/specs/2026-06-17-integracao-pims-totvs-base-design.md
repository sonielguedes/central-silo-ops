# ETAPA 7.1A - Base de Integracao PIMS / TOTVS

## Objetivo
Criar a base de integracao externa da Central SILO OPS para gerar, armazenar, auditar e reprocessar jobs de exportacao operacional. Esta etapa nao conecta em PIMS/TOTVS real; apenas prepara a infraestrutura segura para futuros adapters oficiais.

## Escopo
- Store local de jobs por tenant.
- Modelo padrao de job de exportacao.
- Adapter base.
- Adapter `PIMS_FILE` para gerar arquivo local.
- Adapter `TOTVS_PLACEHOLDER` sem chamada real.
- API autenticada para criar, listar, detalhar, reprocessar e cancelar jobs.
- UI basica em `/ferramentas/integracoes`.
- Acao controlada na Ficha do Operador para gerar job.
- Auditoria de criacao, tentativa, falha, reprocessamento e cancelamento.

## Nao escopo
- Integracao real com PIMS/TOTVS.
- Segredos, tokens, endpoints proprietarios ou layout oficial do cliente.
- Mudanca nas regras da Ficha do Operador ja aprovadas.
- Alteracao de Docker, healthcheck, APK, Kotlin ou storage global.

## Modelo de dados
Entidade principal: `IntegrationExportJob`.

Campos:
- `id`
- `tenantId`
- `sourceModule`
- `sourceType`
- `sourceId`
- `targetSystem`
- `targetAdapter`
- `operationType`
- `payload`
- `payloadHash`
- `status`
- `attemptCount`
- `maxAttempts`
- `lastAttemptAt`
- `exportedAt`
- `acknowledgedAt`
- `errorMessage`
- `createdAt`
- `updatedAt`
- `createdBy`

Status:
- `PENDING`
- `PROCESSING`
- `EXPORTED`
- `ACKNOWLEDGED`
- `FAILED`
- `CANCELLED`
- `REPROCESS_REQUIRED`

## Persistencia
Arquivo por tenant em `data/<tenant>/integration-export-jobs.json` ou equivalente no storage padrao da Central.

Requisitos:
- isolamento total por tenant;
- escrita atomica quando possivel;
- sem sobrescrever historico;
- suporte a reprocessamento sem perda do job original.

## Store
Funcoes obrigatorias:
- `createJob(input)`
- `getJobById(tenantId, id)`
- `listJobs(tenantId, filters)`
- `updateJobStatus(tenantId, id, status, patch)`
- `markProcessing(tenantId, id)`
- `markExported(tenantId, id, result)`
- `markFailed(tenantId, id, error)`
- `retryJob(tenantId, id)`
- `cancelJob(tenantId, id)`

Filtros:
- `targetSystem`
- `sourceModule`
- `status`
- `from`
- `to`
- `sourceId`

## Payload da Ficha
Payload estruturado com:
- `tenantId`
- `sheetId`
- `dataOperacional`
- `frota`
- `operador`
- `matricula`
- `os`
- `operacaoCodigo`
- `operacaoDescricao`
- `centroCusto`
- `implementoCodigo`
- `implementoDescricao`
- `horimetroInicial`
- `horimetroFinal`
- `totalHoras`
- `horasProdutivas`
- `horasParadas`
- `horasIndeterminadas`
- `percentualIndeterminado`
- `statusFicha`
- `validadoPor`
- `validadoEm`
- `exportadoEm`
- `inconsistencias`

Regras:
- nao exportar `EM_ANDAMENTO`;
- nao exportar `INCONSISTENTE` sem `force=true` e permissao;
- `VALIDADO` pode gerar job;
- `EXPORTADO` so pode gerar novo job se `needsReexport=true` ou por reprocessamento;
- remover `undefined`;
- normalizar `NaN`, datas ISO e decimais.

## Adapters
Interface comum:
```ts
export interface IntegrationAdapter {
  readonly targetSystem: string;
  readonly adapterName: string;
  buildPayload(input: unknown): Promise<unknown> | unknown;
  export(job: IntegrationExportJob): Promise<IntegrationExportResult>;
}
```

Resultado:
```ts
export interface IntegrationExportResult {
  success: boolean;
  externalId?: string;
  protocol?: string;
  fileName?: string;
  rawResponse?: unknown;
  errorMessage?: string;
}
```

### PIMS_FILE
- gera arquivo local em `data/<tenant>/exports/pims/`;
- nome rastreavel com data, frota e id do job;
- atualiza job para `EXPORTED`;
- registra `fileName`.

### TOTVS_PLACEHOLDER
- nao chama API real;
- apenas monta payload e registra saida segura;
- pode operar em modo arquivo sem credencial.

## API
Endpoints protegidos por autenticao e RBAC:
- `GET /api/integrations/export-jobs`
- `POST /api/integrations/export-jobs`
- `GET /api/integrations/export-jobs/[id]`
- `POST /api/integrations/export-jobs/[id]/retry`
- `POST /api/integrations/export-jobs/[id]/cancel`

Criacao de job:
```json
{
  "sourceModule": "FICHA_OPERADOR",
  "sourceType": "DAILY_OPERATOR_SHEET",
  "sourceId": "sheet-id",
  "targetSystem": "PIMS",
  "targetAdapter": "PIMS_FILE",
  "operationType": "CREATE"
}
```

Validações:
- exigir sessao;
- respeitar tenant do usuario;
- validar `sourceId`;
- impedir duplicidade por `payloadHash` para job ativo ou exportado;
- permitir reprocessamento controlado.

## UI
Reaproveitar `/ferramentas/integracoes` e trocar o foco para exportacoes externas.

Componentes:
- cards: pendentes, exportados, falhas, reprocessar;
- tabela: data, sistema destino, modulo, origem, status, tentativas, ultimo erro, exportado em, acoes;
- acoes: detalhes, reprocessar, cancelar, baixar arquivo.

## Integracao com Ficha
Acao controlada:
- `Gerar job PIMS`

Disponivel somente para:
- `VALIDADO`
- `EXPORTADO` com reprocessamento permitido

Comportamento:
- cria job;
- registra auditoria;
- nao altera exportacao CSV/TXT existente.

## Auditoria
Registrar:
- criacao de job;
- tentativa de exportacao;
- falha;
- reprocessamento;
- cancelamento.

Usar `audit-log` existente.

## Testes
Cobrir:
1. criar job PIMS a partir de ficha validada;
2. bloquear job para ficha em andamento;
3. gerar payload sem `undefined`;
4. gerar arquivo local PIMS;
5. marcar job como `EXPORTED`;
6. marcar job como `FAILED`;
7. reprocessar job falhado;
8. impedir duplicidade por `payloadHash`;
9. listar jobs por tenant;
10. garantir isolamento por tenant.

## Validacao
- `npm run lint`
- `npm run type-check`
- `npm run build`

## Criterio de aprovacao
A etapa fica pronta quando existir base de jobs, adapters locais, APIs protegidas, UI funcional, acao na ficha, auditoria, testes e build limpo, sem conexao real com PIMS/TOTVS.
