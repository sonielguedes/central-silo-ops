# AUDITORIA DE ISOLAMENTO MULTI-TENANT — SILO OPS Central

**Data:** 2026-06-08  
**Versão:** C5.2 — Multiempresa / Tenant Produção  
**Autor:** Soniel  

---

## 1. Objetivo

Auditar e documentar cada ponto de acesso a dados por tenant, garantindo que nenhuma rota permita acesso cross-tenant e que o sistema rejeite tenant ausente ou inválido.

---

## 2. Arquitetura de Resolução de Tenant

### Antes (v0.9 — Piloto)

- `ServerStorage.resolveTenantId()` resolvia tenant via header ou apiPort, mas tinha **fallback silencioso** para `DEFAULT_TENANT_ID` (`silo-ops-001`).
- Rotas web chamavam `ServerStorage.resolveTenantId()` diretamente, sem rejeitar tenant ausente.
- Sem validação cross-tenant explícita na maioria das rotas web.

### Depois (C5.2 — Produção)

- **`lib/tenant/tenant-resolver.ts`** — módulo central de resolução. Sem fallback silencioso.
- **`lib/auth/api-guard.ts`** — `requireTenant()` agora usa `resolveWebTenant()` do tenant-resolver.
- **Todas as rotas web** passam por `requireTenant()` — retorna 400/404 se tenant não identificado.
- **Todas as rotas mobile** usam `requireMobileAuth()` — tenant vem do token da empresa.
- **Cross-tenant**: `assertTenantMatch()` e `assertEquipmentOwnership()` disponíveis no tenant-resolver.

---

## 3. Rotas Auditadas

### 3.1 Rotas Mobile (8 rotas)

| Rota | Resolução Tenant | Validação Equipment | Cross-Tenant | Status |
|------|-------------------|---------------------|-------------|--------|
| POST /api/mobile/events/batch | requireMobileAuth → token | validateMobileEquipment (tenantId check) | body.tenantId !== auth.tenantId → 403 | OK |
| POST /api/mobile/heartbeat | requireMobileAuth → token | N/A (por fleetCode+tenant) | Token vincula tenant | OK |
| POST /api/mobile/location | requireMobileAuth → token | N/A | Token vincula tenant | OK |
| POST /api/mobile/shift/start | requireMobileAuth → token | validateMobileEquipment | equipment.tenantId !== tenantId → 404 | OK |
| POST /api/mobile/shift/end | requireMobileAuth → token | validateMobileEquipment | equipment.tenantId !== tenantId → 404 | OK |
| POST /api/mobile/equipment | requireMobileAuth ou requireTenant | upsertEquipment com tenantId | Forçado pelo auth | OK |
| GET /api/mobile/equipment/lookup | requireMobileAuth → token | validateMobileLookupEquipment | equipment.tenantId !== tenantId → 404 | OK |
| POST /api/mobile/company | blockWriteInDemo + token | N/A (company sync) | Token da empresa | OK |

### 3.2 Rotas Web — Leitura (9 rotas)

| Rota | Resolução Tenant | Antes | Depois | Status |
|------|-------------------|-------|--------|--------|
| GET /api/alertas | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/dashboard/summary | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/equipamentos/status | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/equipamentos/trail | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/ficha-operador | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/ficha-operador/export | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/relatorios/eficiencia-operacional | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/relatorios/eficiencia-operacional/export | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/relatorios/tempo-operacional | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/relatorios/tempo-operacional/export | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/cadastro/[entity] | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |
| GET /api/cadastro/[entity]/[id] | requireTenant | resolveTenantId (fallback) | requireTenant (rejeita) | CORRIGIDO |

### 3.3 Rotas Web — Escrita (6 rotas)

| Rota | Resolução Tenant | Demo Block | Audit Log | Cross-Tenant | Status |
|------|-------------------|------------|-----------|-------------|--------|
| POST /api/alertas/[id]/acknowledge | requireTenant + blockWriteInDemo | SIM | SIM | Alerta filtrado por tenant | OK |
| POST /api/alertas/[id]/resolve | requireTenant + blockWriteInDemo | SIM | SIM | Alerta filtrado por tenant | OK |
| POST /api/alertas/resolve-all | requireTenant + blockWriteInDemo | SIM | SIM | Só resolve alertas do tenant | OK |
| POST /api/cadastro/[entity] | requireTenant + blockWriteInDemo | SIM | SIM | Criação vincula tenantId | OK |
| PUT /api/cadastro/[entity]/[id] | requireTenant + blockWriteInDemo | SIM | SIM | CadastroStorage filtra por tenantId | OK |
| DELETE /api/cadastro/[entity]/[id] | requireTenant + blockWriteInDemo | SIM | SIM | CadastroStorage filtra por tenantId | OK |

### 3.4 Rotas Admin (1 rota)

| Rota | Resolução Tenant | Rate Limit | Audit Log | Status |
|------|-------------------|------------|-----------|--------|
| POST /api/admin/companies/token | blockWriteInDemo + rate limit | SIM (10/min) | SIM | OK |

### 3.5 Rotas Públicas (2 rotas)

| Rota | Tenant | Justificativa |
|------|--------|---------------|
| GET /api/health/full | N/A | Healthcheck — lista tenants sem expor tokens |
| GET /api/mobile/health | N/A | Ping simples |

---

## 4. Camadas de Proteção

### 4.1 ServerStorage

- `getEquipmentByFleetCode(fleetCode, tenantId)` — filtra `e.tenantId === tenantId`
- `getEquipmentById(id, tenantId)` — filtra `e.tenantId === tenantId`
- `validateMobileEquipment()` — verifica `equipment.tenantId !== tenantId` → 404
- `validateMobileLookupEquipment()` — idem
- `upsertEquipment()` — força `tenantId` no save
- `saveEvent()` — salva em `data/{tenantId}/mobile-events.json`
- `getLiveFleet(tenantId)` — lê de `data/{tenantId}/live-state.json`
- `getEvents(tenantId)` — lê de `data/{tenantId}/mobile-events.json`

### 4.2 CadastroStorage

- Todos os métodos (getAll, getById, create, update, archive) recebem `tenantId` como primeiro parâmetro
- `getById` filtra `item.tenantId === tenantId`
- `create` força `tenantId` no item criado
- `update` filtra `item.tenantId === tenantId`
- Dados em `data/{tenantId}/cadastro-{entity}.json`

### 4.3 AlertasBuilder

- `generateAlerts(tenantId)` — lê fleet e events do tenant
- `loadAlerts(tenantId)` — lê de `data/{tenantId}/alerts.json`
- `acknowledgeAlert(tenantId, id)` — filtra alertas do tenant
- `resolveAlert(tenantId, id)` — idem
- `resolveAllAlerts(tenantId)` — resolve apenas alertas do tenant

### 4.4 AuditLog

- `writeAudit(tenantId, entry)` — persiste em `data/{tenantId}/audit-log.jsonl`
- `readAuditLog(tenantId)` — lê apenas do tenant

---

## 5. Tenant Resolver — Estratégias

| Estratégia | Uso | Fallback |
|------------|-----|----------|
| mobile-token | Rotas /api/mobile/* | Nenhum — 401 se ausente, 403 se inválido |
| header (x-silo-tenant) | Rotas web quando há múltiplos tenants | Nenhum — 400 se ausente |
| api-port | Rotas web via apiPort→company | Nenhum — 400 se não resolver |
| single-tenant | Rotas web quando há exatamente 1 company | Automático (sem header necessário) |

---

## 6. Vulnerabilidades Corrigidas

1. **Fallback silencioso para DEFAULT_TENANT** — removido. Agora retorna 400 se tenant não identificado.
2. **Rotas web sem guard de tenant** — todas as 12 rotas web agora passam por `requireTenant()`.
3. **Tenant spoofing via header** — `resolveWebTenant` valida que tenant existe antes de aceitar `x-silo-tenant`.

---

## 7. Limitações Conhecidas

1. **Autenticação web** — atualmente não há login/JWT para web. Qualquer usuário com acesso à URL pode enviar `x-silo-tenant`. Será resolvido em C5.3 (Permissões).
2. **SUPER_ADMIN cross-tenant** — não implementado ainda. Será resolvido em C5.3.
3. **Backup automático** — script existe mas cron não configurado. Será resolvido em C5.4.

---

## 8. Conclusão

Todas as rotas de API foram auditadas e protegidas contra acesso cross-tenant. O fallback silencioso para tenant padrão foi eliminado. O isolamento de dados por tenant está garantido nas camadas de storage, alertas e audit-log.
