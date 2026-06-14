# Auditoria Técnica — SILO OPS Central
**Data:** 13 de junho de 2026  
**Versão do projeto:** 0.1.0-piloto  
**Branch auditado:** `main`  
**Escopo:** Segurança, arquitetura, qualidade de código, infra e pendências operacionais

---

## Sumário Executivo

O SILO OPS Central é uma aplicação Next.js 14 (App Router) com armazenamento em arquivos JSON por tenant, containerizada via Docker e servida por Nginx. A base de código demonstra cuidado significativo com segurança — autenticação, RBAC, CSRF, rate limiting e audit log estão todos implementados com boas práticas. Os principais riscos identificados concentram-se na infraestrutura de isolamento multi-tenant (volume de dados compartilhado), na ausência de TLS no Nginx, e em 66 arquivos modificados não commitados no branch principal.

---

## 1. 🔴 Crítico — Ação Imediata

### 1.1 Nginx sem HTTPS / TLS

O `nginx.conf` escuta apenas em HTTP (portas 3001, 3002, 3003) e o script `vps-open-ports.sh` abre essas portas diretamente no firewall. Se não há um proxy externo (Cloudflare, load balancer) na frente, todo o tráfego — incluindo cookies de sessão e tokens de empresa — trafega em texto puro.

**Evidência:**
```nginx
server { listen 3001; ... }   # sem ssl_certificate
server { listen 3002; ... }
server { listen 3003; ... }
```

**Ação:** Configurar TLS no Nginx (certificado Let's Encrypt via Certbot) ou garantir que um proxy externo com HTTPS esteja na frente antes de abrir as portas ao público. Adicionar `add_header Strict-Transport-Security` após TLS configurado.

---

### 1.2 Volume de dados compartilhado entre todos os tenants

Os três serviços no `docker-compose.yml` montam o **mesmo** volume físico:

```yaml
silo-piloto:
  volumes: - ./data:/app/data   # ← mesmo diretório

silo-cliente-02:
  volumes: - ./data:/app/data   # ← mesmo diretório

silo-cliente-03:
  volumes: - ./data:/app/data   # ← mesmo diretório
```

A separação dos dados por tenant é feita exclusivamente por código (`data/{tenantId}/`). Um bug no `tenant-resolver.ts` ou um path traversal seria suficiente para um tenant acessar dados de outro.

**Ação:** Separar volumes por tenant (`./data/silo-piloto:/app/data`, `./data/cliente-02:/app/data` etc.) e garantir que cada container só enxergue seu próprio diretório de dados.

---

## 2. 🟡 Atenção — Endereçar Antes do Próximo Deploy

### 2.1 66 arquivos modificados não commitados no `main`

`git status` mostra 66 arquivos com modificações locais (` M`) e ~14 arquivos não rastreados (`??`) que nunca foram adicionados ao repositório. Isso inclui:

- Arquivos de produção como `app/layout.tsx`, `next.config.js`, `nginx.conf`, `Dockerfile`
- Todos os relatórios em `app/relatorios/`
- Componentes de UI (`sidebar.tsx`, `header.tsx`, `kpi-card.tsx`)
- Documentação (`docs/STATUS_P0_IMPLEMENTACAO.md`, etc.)

**Risco:** Estado real do sistema em produção não está refletido no git. Rollback, colaboração e rastreabilidade ficam comprometidos.

**Ação:** Criar um commit (ou uma série de commits semânticos) para limpar o estado do branch. Usar o `commit-commands.ps1` já presente no projeto.

---

### 2.2 `git index.lock` presente

O arquivo `.git/index.lock` está presente (0 bytes), indicando uma operação git que foi interrompida. Isso pode bloquear commits e operações git futuras.

**Ação:**
```bash
rm .git/index.lock
```

---

### 2.3 Arquivos `.bak` no working tree

Dois arquivos de backup foram deixados no projeto e nunca rastreados:
- `lib/auth/auth-store.ts.bak`
- `services/master.service.ts.bak`

Esses arquivos podem conter versões antigas com lógica de segurança diferente e confundir futuras revisões.

**Ação:** Deletar os arquivos ou adicioná-los ao `.gitignore` se forem necessários temporariamente.

---

### 2.4 Rate limiter in-memory não sobrevive a restarts / múltiplas instâncias

O `rate-limit.ts` usa um `Map` em memória com limpeza por `setInterval`. Ao reiniciar o processo, todas as janelas de rate limit são zeradas — um atacante pode forçar um restart para contornar o limite de tentativas de login.

```typescript
const store = new Map<string, WindowEntry>(); // reseta com restart
```

Além disso, se futuras instâncias do Next.js rodarem em paralelo (ex.: clustering), cada processo terá seu próprio contador independente.

**Ação curto prazo:** Documentar a limitação. **Ação longo prazo:** Migrar para Redis ou similar para persistência do rate limit.

---

### 2.5 Bypass de autenticação via header em não-produção

Em `session.ts`, quando `SILO_ALLOW_HEADER_SESSION=true` e `NODE_ENV !== 'production'`, qualquer requisição com o header `x-silo-user-id` é autenticada sem senha:

```typescript
if (process.env.NODE_ENV !== 'production' && process.env.SILO_ALLOW_HEADER_SESSION === 'true') {
  const headerUserId = req.headers.get('x-silo-user-id')?.trim();
  if (!headerUserId) return null;
  const user = AuthStore.getUserById(headerUserId);
  ...
}
```

**Risco:** Se um ambiente de staging/piloto rodar com `NODE_ENV=development` por engano, qualquer pessoa com acesso à rede pode autenticar como qualquer usuário.

**Ação:** Garantir que ambientes de piloto usem `NODE_ENV=production` e que `SILO_ALLOW_HEADER_SESSION` seja omitido ou `false` em todos os ambientes não-locais.

---

### 2.6 Diretório `kotlin/` não rastreado no repositório

Um diretório `kotlin/` está presente no working tree mas não rastreado pelo git. Presume-se que seja o código do APK mobile.

**Ação:** Mover para um repositório separado (`silo-ops-mobile`) ou adicionar ao `.gitignore` se for intencional manter localmente.

---

### 2.7 `NEXT_PUBLIC_APP_VERSION` ausente no `.env.production`

O `.env.production.example` define `NEXT_PUBLIC_APP_VERSION`, mas o `.env.production` atual não inclui essa variável. Isso pode causar `undefined` em logs e na UI de versionamento.

**Ação:** Adicionar `NEXT_PUBLIC_APP_VERSION=v0.1.0-piloto` ao `.env.production`.

---

### 2.8 `docker-compose.yml` referencia variáveis não definidas no `.env.production`

O `docker-compose.yml` referencia:
- `NEXT_PUBLIC_CENTRAL_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `API_BASE_URL`
- `MOBILE_INGEST_TOKEN`

Nenhuma dessas variáveis aparece no `.env.production` atual. O Docker Compose silenciosamente passa strings vazias.

**Ação:** Auditar quais variáveis são efetivamente necessárias em produção e completar o `.env.production` com valores reais.

---

## 3. 🟢 Positivo — Bem Implementado

### 3.1 Autenticação sólida

- Cookie de sessão `httpOnly`, `sameSite: lax`, `secure: true` em produção.
- Sessão assinada com HMAC-SHA256 via `SILO_AUTH_SECRET` (padrão double-cookie-submit).
- Hash de senha com `bcrypt` (rounds: 12).
- Escrita atômica dos arquivos de auth com padrão write-then-rename — sem corrupção em caso de crash.
- TTL de sessão de 8h com limpeza de sessões expiradas.

### 3.2 RBAC completo e bem estruturado

13 roles com matriz de permissões explícita por módulo e ação (`ROLE_PERMISSIONS`). Separação clara entre:
- `rbac-shared.ts` — lógica client-safe
- `rbac-server.ts` — guards server-only com audit log em cada deny
- Resolução de role canônica via `canonicalRole()` para aliases

### 3.3 Proteção CSRF correta

Implementação via double-submit cookie (`silo_csrf`). O token é validado via `requireCsrf()` em todas as mutações. O cookie CSRF é gerado no login e renovado adequadamente.

### 3.4 Rate limiting nas rotas críticas

| Rota | Limite |
|------|--------|
| Login | 10 req/min por IP |
| Admin token | 10 req/min por IP |
| Mobile batch | 120 req/min por IP |
| Mobile heartbeat | 120 req/min por IP |

### 3.5 Proteção contra cross-tenant injection

O `api-guard.ts` bloqueia ativamente tentativas de injeção de tenant via header para usuários com scope `TENANT`:

```typescript
if (requestedTenant && requestedTenant !== sessionTenantId) {
  // rejeitado com 403 + audit log
}
```

### 3.6 Audit log append-only por tenant

`audit-log.ts` escreve em `data/{tenantId}/audit-log.jsonl` com contexto completo: IP, user-agent, userId, before/after, metadata. Falhas de escrita apenas logam sem quebrar a requisição.

### 3.7 Docker com boas práticas

- Build multi-stage (builder → runner) — imagem final sem devDependencies.
- Usuário não-root (`nextjs:nodejs`).
- Healthcheck em `/api/health/full` tanto no Dockerfile quanto no Compose.
- `restart: unless-stopped` em todos os serviços.
- Logs com rotação (`max-size: 10m`, `max-file: 3`).

### 3.8 Nginx com headers de segurança

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
server_tokens off;
```

### 3.9 TypeScript e ESLint limpos

- `tsc --noEmit`: **0 erros**
- `next lint`: **0 warnings, 0 errors**

### 3.10 `.env.production` protegido no `.gitignore`

O arquivo `.env.production` (que pode conter `SILO_AUTH_SECRET`) está corretamente listado no `.gitignore` e nunca foi commitado.

---

## 4. Melhorias de Qualidade de Código

### 4.1 `payload: any` em `server-storage.ts`

```typescript
export interface MobileEvent {
  ...
  payload: any;  // ← evitar any
}
```

**Ação:** Tipar como `Record<string, unknown>` ou criar uma interface `MobileEventPayload`.

### 4.2 `require()` dinâmico em `tenant-resolver.ts`

A função `tenantExists()` usa `require('fs')` e `require('path')` dentro do corpo da função, em vez de imports estáticos no topo do arquivo. Além de ser antipadrão, pode gerar cache-miss em alguns bundlers.

**Ação:** Mover os imports para o topo do arquivo.

### 4.3 `GESTOR_COA` ausente da sidebar mas presente no RBAC

O role `GESTOR_COA` é resolvido como alias de `GESTOR` em `canonicalRole()` mas a entrada em `ROLE_PERMISSIONS` é vazia `[]`. A resolução funciona corretamente, mas a documentação interna pode confundir.

**Ação:** Adicionar comentário explicativo indicando que roles com `[]` são aliases resolvidos via `canonicalRole()`.

---

## 5. Checklist de Ações Prioritárias

| # | Severidade | Ação |
|---|-----------|------|
| 1 | 🔴 Crítico | Configurar TLS no Nginx ou confirmar proxy externo HTTPS |
| 2 | 🔴 Crítico | Separar volumes Docker por tenant |
| 3 | 🟡 Alta | Commitar os 66 arquivos modificados + resolver `index.lock` |
| 4 | 🟡 Alta | Completar `.env.production` com variáveis faltantes |
| 5 | 🟡 Média | Remover arquivos `.bak` do working tree |
| 6 | 🟡 Média | Garantir `NODE_ENV=production` e `SILO_ALLOW_HEADER_SESSION=false` no piloto |
| 7 | 🟡 Média | Mover código `kotlin/` para repositório separado |
| 8 | 🟢 Baixa | Migrar rate limiter para Redis em versão futura |
| 9 | 🟢 Baixa | Substituir `payload: any` por tipo explícito |
| 10 | 🟢 Baixa | Mover `require()` dinâmicos para imports estáticos |

---

*Auditoria gerada em 13/06/2026 — SILO OPS Central v0.1.0-piloto*
