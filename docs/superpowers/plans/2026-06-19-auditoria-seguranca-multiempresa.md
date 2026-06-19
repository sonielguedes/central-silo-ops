# ETAPA 6.13 — Auditoria de Segurança Multiempresa / Isolamento de Tenant

**Data:** 2026-06-19
**Destino:** CENTRAL WEB + API + APK
**Status:** ✅ Concluído

## Objetivo

Auditar 17 áreas de segurança da plataforma SILO OPS para garantir que Empresa A não acessa dados da Empresa B. Corrigir vulnerabilidades encontradas. Criar testes de segurança. Documentar.

## Restrições Aplicadas

- NÃO MEXER: API, filtros, regra de status, contagem de equipamentos, mapa, rastro, popup, jornada, sincronização
- Não hardcodar valores de contagem
- Não transformar `frota` ou `matrícula` em número

## Área Auditada

### 1. Storage e APIs (✅ OK com observação)

**ServerStorage:** todos os métodos usam `tenantId` explícito. `getEquipmentByFleetCode(fleetCode, tenantId = DEFAULT_TENANT_ID)` — default param seguro (env var, não literal) mas rotas devem sempre passar `tenantId` explicitamente.

**CadastroStorage / FichaStore:** totalmente isolados por `data/{tenantId}/`.

**getCompanies():** global por design — acesso restrito a `SUPER_ADMIN_SILO` via RBAC.

### 2. RBAC e Proteção de Rotas (✅ OK + correção crítica)

**API routes:** todos protegidos por `requireTenant()` (web) ou `requireMobileAuth()` (APK).
`requireTenant()` resolve `tenantId` exclusivamente do cookie de sessão — header `x-silo-tenant-id` é ignorado.

**Páginas Next.js:** PROBLEMA CRÍTICO encontrado — sem `middleware.ts`, toda proteção era client-side.
**Correção:** `middleware.ts` criado com verificação HMAC-SHA256 server-side.

### 3. Segurança HTTP (✅ OK + correção crítica)

**Security headers:** ausentes. Adicionados em `next.config.js`:
- X-Frame-Options, X-Content-Type-Options, Referrer-Policy, CSP, Permissions-Policy, HSTS (produção)

**CSRF:** comparação string substituída por `timingSafeEqual` em `lib/auth/csrf.ts`.

### 4. Autenticação Mobile (✅ OK)

Rotas `/api/mobile/*` usam `requireMobileAuth()` que valida `X-Company-Token` contra banco — `tenantId` resolvido do token, não de header injetável.

### 5. Outras Áreas (✅ OK)

- Senhas: bcrypt cost 12
- Sessões: HMAC-SHA256, TTL 8h, revogação suportada
- Logs: sem senha, companyToken, cookie ou dados sensíveis

## Testes Criados

| Arquivo | Testes | Status |
|---------|--------|--------|
| `tests/security-session-hmac.test.mjs` | 8 | ✅ 8/8 pass |
| `tests/security-csrf-timing.test.mjs` | 9 | ✅ 9/9 pass |
| `tests/multitenant-isolation.test.mjs` | pré-existente | ✅ |
| `tests/rbac-permissions.test.mjs` | pré-existente | ✅ |

## Arquivos Modificados

```
middleware.ts                              ← NOVO
lib/auth/csrf.ts                           ← timingSafeEqual
next.config.js                             ← security headers
tests/security-session-hmac.test.mjs       ← NOVO
tests/security-csrf-timing.test.mjs        ← NOVO
docs/CHANGELOG.md                          ← atualizado
docs/superpowers/plans/2026-06-19-*.md    ← NOVO
docs/superpowers/specs/2026-06-19-*.md    ← NOVO
```
