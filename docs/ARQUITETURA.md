# Arquitetura — SILO OPS Central

**Data:** 2026-06-16  
**Versão:** v0.1.0-piloto  

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript 5 |
| UI | Tailwind CSS + lucide-react |
| Formulários | react-hook-form + zod |
| Armazenamento | CadastroStorage (JSON por tenant em disco) |
| Autenticação | Session cookie + NextAuth-compatible flow |
| CSRF | Double-submit cookie (`silo_csrf`) |
| Deploy | Docker + Nginx (reverse proxy) |
| Infra | VPS em `/opt/siloops-central` |

---

## Multi-tenant

Cada empresa (tenant) opera isolada:

```
data/
  {tenantId}/
    cadastro-equipamentos.json
    cadastro-operadores.json
    cadastro-paradas.json
    cadastro-centros-custo.json
    cadastro-operacoes.json
    ...
    mobile-events.json
    live-state.json
    alerts.json
    audit-log.jsonl
```

### Resolução de tenant

| Camada | Mecanismo |
|--------|-----------|
| Web (Central) | Session cookie — `requireTenant()` em `lib/auth/api-guard.ts` |
| Mobile (APK) | `X-Company-Token` — `requireMobileAuth()` → `getCompanyByToken` → `company.tenantId` |

O `tenantId` **nunca** é lido de header enviado pelo cliente. Divergências entre header e sessão/token resultam em 403.

---

## CadastroStorage

`lib/cadastro-storage.ts` — camada de persistência para entidades de cadastro.

```typescript
CadastroStorage.getAll(tenantId, 'paradas')           // lista todos
CadastroStorage.create(tenantId, 'paradas', item)     // cria com ID gerado
CadastroStorage.update(tenantId, 'paradas', id, data) // atualiza por ID
CadastroStorage.archive(tenantId, 'paradas', id)      // arquiva (soft delete)
```

Arquivos JSON em `data/{tenantId}/cadastro-{entity}.json`. Seed aplicado quando o arquivo não existe e `shouldSeedDemoData() === true`.

### Rota genérica de cadastro

`/api/cadastro/[entity]` — CRUD genérico que delega ao `CadastroStorage`. Entidades com rotas dedicadas (ex: `/api/centros-custo`) sobrepõem a rota genérica para lógica de validação customizada (ex: unicidade de código).

---

## Autenticação e Segurança

### CSRF
- Cookie `silo_csrf` (httpOnly: false) — lido pelo cliente via `getCsrfTokenFromDocument()`
- Header `x-csrf-token` — enviado por `getHeaders()` em `services/api-service.ts`
- `requireCsrf()` no backend valida `cookie === header`
- **Presente em todas as rotas de mutação** (POST, PUT, DELETE)

### RBAC
- `lib/auth/rbac-shared.ts` — roles, módulos, ações, matriz de permissões
- `MODULE_ALIAS` mapeia nomes uppercase de módulos para `Module` type
- `ROUTE_MODULE_MAP` mapeia padrões de URL para módulo
- `withAuth(Component, { module: 'MODULE_NAME' })` HOC para proteção de páginas
- `canAccessRoute(role, href)` usado pelo sidebar para filtrar itens visíveis

### Roles disponíveis
`SUPER_ADMIN_SILO` · `SUPER_ADMIN` · `ADMIN_EMPRESA` · `GESTOR` · `GESTOR_COA` · `COA` · `SUPERVISOR_FRENTE` · `OPERADOR_CENTRAL` · `MANUTENCAO` · `CLIENTE_RELATORIOS` · `OPERADOR_APK` · `CONSULTA` · `AUDITOR`

---

## API Mobile

Todas as rotas mobile em `/api/mobile/*`:
- Autenticadas via `requireMobileAuth()` → `X-Company-Token`
- `tenantId` derivado exclusivamente do token
- Rate limiting em rotas sensíveis

Rotas principais:
- `GET /api/mobile/bootstrap` — pacote de dados mestres para o APK
- `POST /api/mobile/events/batch` — eventos de jornada em lote
- `POST /api/mobile/shift/start` e `/shift/end` — controle de jornada
- `POST /api/mobile/heartbeat` — sinal de vida do dispositivo
- `POST /api/mobile/location` — posição GPS
- `GET /api/mobile/company/validate` — validação do QR Code

---

## Fluxo de dados APK → Central

```
APK lê QR Code
  → POST /api/mobile/company/validate (valida token, retorna config)
  → GET  /api/mobile/bootstrap (carrega dados mestres)
  → POST /api/mobile/shift/start (inicia jornada)
  → POST /api/mobile/events/batch (eventos, GPS, paradas)
  → POST /api/mobile/heartbeat (sinal de vida a cada ~30s)
  → POST /api/mobile/shift/end (encerra jornada)

Central consome:
  → GET  /api/equipamentos/status (live-state: dashboard, mapa, conectividade, ficha)
  → GET  /api/equipamentos/trail (rastro GPS)
```

---

## Services (Frontend)

`services/api-service.ts` — todos os serviços de API do frontend.

- `makeService<T>(entity)` — fábrica para CRUD genérico via `/api/cadastro/{entity}`
- Serviços dedicados: `CostCenterService` → `/api/centros-custo`
- `getHeaders()` — injeta CSRF token + dados de sessão automaticamente
- `credentials: 'include'` — garante envio do cookie de sessão em todas as requisições

---

## Seed de dados

`lib/mock/master-data.ts` — dados iniciais para novos tenants.

`SEED_MAP` define o que é seedado por entidade. Aplicado em `CadastroStorage` quando o arquivo JSON não existe. Tipos de implementos (12 tipos) e modelos (26 modelos) adicionados em 2026-06-16.
