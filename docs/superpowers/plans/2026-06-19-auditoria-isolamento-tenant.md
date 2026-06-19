# ETAPA 6.13B — Auditoria de Isolamento de Tenant / Dados por Empresa

**Data:** 2026-06-19
**Destino:** CENTRAL WEB + API MOBILE
**Status:** ✅ APROVADO

## Objetivo

Garantir que uma empresa/tenant nunca consiga acessar, listar, exportar, alterar ou sincronizar dados de outra empresa. Destilaria Tabu não vê dados da SEEME e vice-versa.

## Empresas Usadas no Teste

| Empresa | tenantId | Frota | Operador |
|---------|----------|-------|----------|
| Destilaria Tabu | destilariatabu-001 | DT-100 | 0001 |
| SEEME | seeme-ops-001 | SM-200 | 0002 |

## Rotas Auditadas

### APIs Web (55 rotas)

Todas as rotas privadas auditadas — nenhuma com falha de isolamento.

| Rota | Guard | Status |
|------|-------|--------|
| /api/dashboard/summary | requireTenant | ✅ |
| /api/equipamentos/status | requireTenant | ✅ |
| /api/equipamentos/trail | requireTenant | ✅ |
| /api/timeline | requireTenant | ✅ |
| /api/operacoes/ativas | requireTenant | ✅ |
| /api/ficha-operador | requireTenant | ✅ |
| /api/ficha-operador/export | requireTenant | ✅ |
| /api/relatorios/eficiencia-operacional | requireTenant | ✅ |
| /api/relatorios/tempo-operacional | requireTenant | ✅ |
| /api/alertas/* | requireTenant | ✅ |
| /api/abastecimentos | requireTenant | ✅ |
| /api/centros-custo/* | requireTenant | ✅ |
| /api/ordens-servico/* | requireTenant | ✅ |
| /api/cadastro/[entity]/* | requireTenant | ✅ |
| /api/eventos | requireTenant | ✅ |
| /api/integrations/export-jobs/* | requireTenant | ✅ |
| /api/admin/companies/* | SUPER_ADMIN_SILO + scope check | ✅ |
| /api/auth/* | session/CSRF guard | ✅ (rotas auth corretas) |
| /api/notifications/* | resolveSession + tenant | ✅ |
| /api/company/current | resolveSession + role check | ✅ |

### APIs Mobile

| Rota | Guard | Status |
|------|-------|--------|
| /api/mobile/events/batch | requireMobileAuth | ✅ |
| /api/mobile/bootstrap | requireMobileAuth | ✅ |
| /api/mobile/equipment/[fleetCode]/last-hourmeter | requireMobileAuth | ✅ |
| /api/mobile/heartbeat | requireMobileAuth | ✅ |
| /api/mobile/location | requireMobileAuth | ✅ |
| /api/mobile/journeys/start | requireMobileAuth | ✅ |
| /api/mobile/shift/start | requireMobileAuth | ✅ |
| /api/mobile/shift/end | requireMobileAuth | ✅ |
| /api/mobile/device-link/* | requireMobileAuth | ✅ |
| /api/mobile/fuelings/batch | delega para events/batch | ✅ |

## Storage Auditado

Todos os dados operacionais isolados em `data/{tenantId}/`:
- `live-state.json` — por tenant ✅
- `mobile-events.json` — por tenant ✅
- `equipments.json` — por tenant ✅
- `journeys/` — por tenant ✅
- `equipment-trails/` — por tenant ✅
- `operator-sheets/` — por tenant (FichaStore) ✅
- Cadastros (CadastroStorage) — por tenant ✅

## Issues Encontrados e Corrigidos

### [FIX] requireMobileAuth: token inválido retornava 403, deve ser 401
- **Arquivo:** `lib/auth/api-guard.ts`
- **Problema:** Token desconhecido retornava 403 (Forbidden). Spec exige 401 (Unauthorized).
- **Correção:** Status alterado para 401 na branch `!rawCompany`.

### [FIX] requireMobileAuth: não verificava X-Tenant-Id divergente
- **Arquivo:** `lib/auth/api-guard.ts`
- **Problema:** O APK podia enviar `X-Tenant-Id: seeme-ops-001` com token da Destilaria Tabu e o header era silenciosamente ignorado (o tenant correto era resolvido do token, então não havia data leak, mas o spec exige rejeição explícita).
- **Correção:** Adicionada verificação explícita: se `X-Tenant-Id` ou `X-Silo-Tenant` header divergir do `tenantId` resolvido pelo token, retornar 403 com log de warning.

## Confirmado OK (sem issues)

- requireTenant() já bloqueava x-tenant-id divergente para usuários TENANT scope
- SUPER_ADMIN só acessa rotas globais (/api/admin/*) com scope check explícito
- Frotas e matrículas permanecem como strings em todos os paths auditados
- Storage usa `data/{tenantId}/` para todos os arquivos operacionais
- Companytoken mascarado em logs (maskToken)
- Nenhum dado sensível nos logs (passwords, tokens completos, cookies)

## Testes Criados

| Arquivo | Testes | Resultado |
|---------|--------|-----------|
| tests/security-tenant-isolation.test.mjs | 15 | ✅ 15/15 |
| tests/mobile-tenant-auth.test.mjs | 13 | ✅ 13/13 |

## Arquivos Modificados

```
lib/auth/api-guard.ts                              ← token inválido → 401 + X-Tenant-Id check
tests/security-tenant-isolation.test.mjs           ← NOVO
tests/mobile-tenant-auth.test.mjs                  ← NOVO
docs/superpowers/plans/2026-06-19-auditoria-isolamento-tenant.md  ← NOVO
docs/CHANGELOG.md                                  ← atualizado
```

## Critério de Aprovação — Checklist

- [x] Empresa A não vê dados da empresa B
- [x] Empresa B não vê dados da empresa A
- [x] Usuário comum não acessa /instancias (SUPER_ADMIN only)
- [x] ADMIN_EMPRESA não lista empresas globais
- [x] APIs web filtram por tenant (requireTenant em todas)
- [x] APIs mobile resolvem tenant pelo companyToken
- [x] Header X-Tenant-Id divergente é rejeitado com 403
- [x] Token mobile inválido retorna 401
- [x] Mapa/Live-state filtra por tenant
- [x] Timeline filtra por tenant
- [x] Rastro filtra por tenant
- [x] Ficha Operador filtra por tenant
- [x] Relatórios filtram por tenant
- [x] Storage usa pasta por tenant
- [x] Frotas e matrículas são strings (nunca número)
- [x] Logs não vazam segredo (maskToken, sem senha/cookie)
- [x] Testes de tenant passam
- [x] Documentação atualizada
