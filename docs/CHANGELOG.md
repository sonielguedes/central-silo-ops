## [2026-06-19] ETAPA 6.13C — Deploy VPS + Validação de Segurança em Produção

### Escopo
Preparação do deploy de produção com validação de segurança completa (central.siloops.com.br).

### Script de deploy criado
`scripts/deploy-6.13c.sh` — execução automatizada de todas as 16 etapas do spec:
backup → pull → npm ci → lint → type-check → build → docker rebuild → 16 validações curl

### Validação local pré-deploy (código verificado)
- middleware.ts presente com rotas públicas corretas (APK não bloqueado)
- Security headers configurados (X-Frame-Options, CSP, HSTS, etc.)
- Token mobile inválido → 401 confirmado no código
- X-Tenant-Id divergente → 403 confirmado no código
- CSRF com timingSafeEqual confirmado
- 45/45 testes de segurança passando

### Pendente
Execução do script na VPS (`bash scripts/deploy-6.13c.sh TOKEN_A TOKEN_B`).
Aguarda aprovação do operador após execução em produção.

### Arquivo Criado
- `scripts/deploy-6.13c.sh` ← script automatizado

---

## [2026-06-19] ETAPA 6.13B — Auditoria de Isolamento de Tenant / Dados por Empresa

### Escopo
Auditoria completa de isolamento multiempresa: Destilaria Tabu ↔ SEEME. Verificação de 55 rotas web + 10 rotas mobile + storage.

### Correções em lib/auth/api-guard.ts

#### requireMobileAuth: token inválido → 401 (era 403)
Token desconhecido (não encontrado no banco) agora retorna 401 Unauthorized em vez de 403 Forbidden. Spec: "token inválido retorna 401".

#### requireMobileAuth: X-Tenant-Id divergente → 403
Se o APK enviar `X-Tenant-Id` ou `X-Silo-Tenant` que diverge do `tenantId` resolvido pelo `X-Company-Token`, a requisição é rejeitada com 403 e warning é logado.

### Confirmado OK (auditoria)
- 55 rotas web todas protegidas por requireTenant() ou guard equivalente
- 10 rotas mobile todas protegidas por requireMobileAuth()
- Storage: todos os arquivos operacionais sob data/{tenantId}/
- requireTenant() já bloqueava x-tenant-id divergente para TENANT scope
- Frotas e matrículas são strings em todos os paths

### Arquivos Criados/Modificados
- `lib/auth/api-guard.ts` — 2 correções em requireMobileAuth
- `tests/security-tenant-isolation.test.mjs` ← NOVO (15 testes, 15/15 pass)
- `tests/mobile-tenant-auth.test.mjs` ← NOVO (13 testes, 13/13 pass)
- `docs/superpowers/plans/2026-06-19-auditoria-isolamento-tenant.md` ← NOVO

---

## [2026-06-19] ETAPA 6.13 — Auditoria de Segurança Multiempresa / Isolamento de Tenant

### Escopo
Auditoria completa de 17 áreas de segurança. Verificação de isolamento de tenant entre empresas distintas (Empresa A não deve ver dados da Empresa B). Correções de vulnerabilidades encontradas.

### Achados e Correções

#### [CRÍTICO] Sem proteção server-side das páginas
**Problema:** Nenhum `middleware.ts` existia. Toda proteção de rota era client-side via HOC `withAuth`. Um request SSR direto bypassa o guard.
**Correção:** Criado `middleware.ts` na raiz do projeto com verificação HMAC-SHA256 do cookie `silo_session` usando Web Crypto API (Edge-compatible). Redireciona para `/login` com parâmetro `next` em caso de sessão inválida ou ausente.

#### [CRÍTICO] Ausência de security headers HTTP
**Problema:** `next.config.js` não definia nenhum header de segurança HTTP (X-Frame-Options, CSP, HSTS, etc.).
**Correção:** Adicionados em `next.config.js`:
- `X-Frame-Options: SAMEORIGIN` — prevenção de clickjacking
- `X-Content-Type-Options: nosniff` — prevenção de MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` — restringe fontes de scripts, imagens e conexões
- `Permissions-Policy` — desabilita camera, microfone, geolocalização
- `Strict-Transport-Security` (produção apenas) — HSTS com 2 anos

#### [BAIXO] Comparação CSRF com string equality
**Problema:** `requireCsrf()` em `lib/auth/csrf.ts` usava `cookie !== header` (string comparison), vulnerável a timing attacks.
**Correção:** Substituído por `crypto.timingSafeEqual` com verificação de tamanho prévia.

#### [INFO] Sessões expiradas acumuladas em disco
**Status:** Risco funcional baixo (sessões expiradas são ignoradas na resolução). Limpeza automática já existe via `cleanupExpiredSessions()`. Sem correção urgente necessária.

#### [INFO] Rate limiting em memória (reinicia com o processo)
**Status:** By-design para o ambiente atual. Recomendado persistir em Redis para produção.

### Confirmado OK (sem issues)
- Todos os API routes protegidos por `requireTenant()` ou `requireMobileAuth()`
- Storage (`ServerStorage`, `CadastroStorage`, `FichaStore`) totalmente isolado por tenant via `data/{tenantId}/`
- Rotas mobile (`/api/mobile/*`) usam `X-Company-Token` resolvido exclusivamente do banco — sem injeção por header
- RBAC via `requirePermission()` e `requireRole()` funciona corretamente
- Cookie de sessão assinado com HMAC-SHA256 + `timingSafeEqual` na verificação
- `.env.production` já no `.gitignore`

### Arquivos Criados/Modificados
- `middleware.ts` ← NOVO — proteção server-side de todas as rotas
- `lib/auth/csrf.ts` — `requireCsrf()` usa `timingSafeEqual`
- `next.config.js` — security headers adicionados
- `tests/security-session-hmac.test.mjs` ← NOVO — 8 testes de HMAC do cookie
- `tests/security-csrf-timing.test.mjs` ← NOVO — 9 testes de CSRF timing-safe
- `docs/superpowers/plans/2026-06-19-auditoria-seguranca-multiempresa.md` ← NOVO
- `docs/superpowers/specs/2026-06-19-tenant-isolation-rbac.md` ← NOVO

### Resultados dos Testes
- `security-session-hmac.test.mjs`: 8/8 pass
- `security-csrf-timing.test.mjs`: 9/9 pass

---

## [2026-06-18] HOTFIX UI — Refinar Legenda do Mapa Operacional

### Problema
Legenda com fundo de baixo contraste, sem bolinhas de status, contadores desalinhados.

### Arquivos Alterados
- `components/map/equipment-map-legend.tsx` — min-w-0, truncate, shrink-0
- `components/dashboard/operational-map.tsx` — card visual refinado, StatusItem reescrito, cn removido

### Resultado
Legenda com card escuro translúcido, bolinhas coloridas com glow, contadores alinhados, tipografia limpa.