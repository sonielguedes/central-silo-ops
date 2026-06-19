# Spec — Tenant Isolation e RBAC (SILO OPS)

**Data:** 2026-06-19
**Versão:** 1.0

## Princípios de Isolamento de Tenant

1. **Toda leitura de dado operacional** deve filtrar por `tenantId` obtido exclusivamente da sessão autenticada
2. **Nunca** aceitar `tenantId` de parâmetro de URL, body ou header quando o dado é privado do tenant
3. **Rotas mobile** resolvem `tenantId` do `X-Company-Token` validado no banco — sem injeção externa

## Autenticação Web

### Cookie de Sessão
- Nome: `silo_session`
- Formato: `{sessionId}.{HMAC-SHA256-hex}`
- Secret: `SILO_AUTH_SECRET` (obrigatório em produção)
- TTL: 8 horas
- `httpOnly: true`, `sameSite: 'lax'`, `secure: true` (produção)

### Middleware Server-Side
- **Arquivo:** `middleware.ts` (raiz do projeto)
- **Runtime:** Edge (Web Crypto API)
- **Ação:** Verifica HMAC do cookie; redireciona para `/login?next={pathname}` se inválido
- **Rotas públicas:** `/login`, `/api/auth/*`, `/api/mobile/*`, `/api/health/*`, `/_next/*`

### CSRF
- Cookie `silo_csrf` (`httpOnly: false`) + header `x-csrf-token`
- Comparação: `crypto.timingSafeEqual` (proteção timing-safe)
- Aplicado em todas as mutations (POST/PUT/PATCH/DELETE)

## Autenticação Mobile (APK)

- Header: `X-Company-Token`
- Validação: token comparado com hash no banco via `requireMobileAuth()`
- `tenantId` resolvido do registro do token — sem override por header

## RBAC

| Role | Nível | Acesso |
|------|-------|--------|
| `SUPER_ADMIN_SILO` | PLATFORM | Todos os tenants (via activeTenantId na sessão) |
| `ADMIN_EMPRESA` | TENANT | Apenas próprio tenant |
| `GESTOR`, `GESTOR_COA` | TENANT | Leitura/escrita operacional |
| `COA`, `SUPERVISOR_FRENTE` | TENANT | Leitura operacional |
| `OPERADOR_APK` | TENANT | Apenas rotas mobile |
| `CONSULTA`, `AUDITOR` | TENANT | Leitura apenas |

## Security Headers HTTP

Todos os headers definidos em `next.config.js` via `async headers()`:

| Header | Valor |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Content-Security-Policy` | ver `next.config.js` para valor completo |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (produção) |

## Regras de Log

**Nunca registrar em logs:**
- Senhas (nem hash)
- `companyToken` completo
- Cookie `silo_session`
- Dados pessoais sensíveis do usuário

**Registrar (sem dados sensíveis):**
- `[auth] login success userId={id} tenantId={id}`
- `[auth] session invalid`
- `[mobile-auth] token válido tenantId={id}` (sem o token)
