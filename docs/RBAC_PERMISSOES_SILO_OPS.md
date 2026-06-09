# RBAC — Papéis e Permissões — SILO OPS Central

**Data:** 2026-06-08  
**Versão:** C5.3  
**Arquivo técnico:** `lib/auth/rbac.ts`  

---

## 1. Papéis do Sistema

| Papel | Nível | Descrição |
|-------|-------|-----------|
| SUPER_ADMIN | 100 | Acesso total, todas as empresas, configuração global |
| ADMIN_EMPRESA | 80 | Gestão completa da própria empresa |
| GESTOR | 60 | Dashboard, relatórios, alertas, operações |
| COA | 40 | Centro de Operações: tempo real, mapa, alertas |
| AUDITOR | 30 | Audit-log e relatórios. Sem escrita |
| CONSULTA | 20 | Somente leitura em dashboard e relatórios |

---

## 2. Módulos

dashboard, mapa, operacoes, equipamentos, operadores, alertas, relatorios, cadastros, administracao, audit-log, configuracoes, sincronizacao

---

## 3. Ações

visualizar, criar, editar, arquivar, exportar, aprovar, administrar, reconhecer

---

## 4. Matriz de Permissões

### SUPER_ADMIN
Acesso total a todos os módulos com todas as ações.

### ADMIN_EMPRESA

| Módulo | Ações |
|--------|-------|
| dashboard | visualizar, exportar |
| mapa | visualizar |
| operacoes | visualizar, exportar |
| equipamentos | visualizar, criar, editar, arquivar, exportar |
| operadores | visualizar, criar, editar, arquivar, exportar |
| alertas | visualizar, reconhecer, exportar |
| relatorios | visualizar, exportar |
| cadastros | visualizar, criar, editar, arquivar, exportar |
| administracao | visualizar, criar, editar |
| audit-log | visualizar |
| configuracoes | visualizar, criar, editar, arquivar |
| sincronizacao | visualizar |

### GESTOR

| Módulo | Ações |
|--------|-------|
| dashboard | visualizar, exportar |
| mapa | visualizar |
| operacoes | visualizar, exportar |
| equipamentos | visualizar, exportar |
| operadores | visualizar, exportar |
| alertas | visualizar, reconhecer, exportar |
| relatorios | visualizar, exportar |
| cadastros | visualizar |
| sincronizacao | visualizar |

### COA

| Módulo | Ações |
|--------|-------|
| dashboard | visualizar |
| mapa | visualizar |
| operacoes | visualizar |
| equipamentos | visualizar |
| alertas | visualizar, reconhecer |
| sincronizacao | visualizar |

### CONSULTA

| Módulo | Ações |
|--------|-------|
| dashboard | visualizar |
| mapa | visualizar |
| operacoes | visualizar |
| equipamentos | visualizar |
| operadores | visualizar |
| alertas | visualizar |
| relatorios | visualizar, exportar |

### AUDITOR

| Módulo | Ações |
|--------|-------|
| dashboard | visualizar |
| relatorios | visualizar, exportar |
| audit-log | visualizar, exportar |
| alertas | visualizar |

---

## 5. Proteção por Camada

### 5.1 API (Server-Side)

Função: `requirePermission(req, module, action, tenantId)`

Rotas protegidas:

| Rota | Módulo | Ação |
|------|--------|------|
| POST /api/cadastro/[entity] | cadastros | criar |
| PUT /api/cadastro/[entity]/[id] | cadastros | editar |
| DELETE /api/cadastro/[entity]/[id] | cadastros | arquivar |
| GET /api/cadastro/[entity] | cadastros | visualizar |
| POST /api/alertas/[id]/acknowledge | alertas | reconhecer |
| POST /api/alertas/[id]/resolve | alertas | editar |
| POST /api/alertas/resolve-all | alertas | administrar |
| POST /api/admin/companies/token | administracao | administrar |

Negações são registradas no audit-log com ação `PERMISSION_DENIED`.

### 5.2 Frontend — Sidebar

A sidebar filtra itens automaticamente via `canRoute(href)`:

- Cada href é mapeado para um módulo via `SIDEBAR_MODULE_MAP`
- Se o papel não tem `visualizar` no módulo, o item não aparece
- Grupos vazios (todos os itens filtrados) são ocultados

### 5.3 Frontend — Páginas

O HOC `withAuth(Component, { module, action })` bloqueia acesso direto:

- Redireciona para login se não autenticado
- Exibe "Acesso Negado" com papel atual se permissão insuficiente
- Botão de volta ao Dashboard

---

## 6. Fluxo de Autenticação

1. Usuário acessa `/login` e insere email + senha
2. `auth-context` busca o usuário via `UserService.getAll()`
3. `accessGroupId` é mapeado para `SystemRole` via `resolveRole()`
4. Sessão salva em `localStorage` (piloto)
5. `checkPermission(module, action)` consulta a matriz RBAC
6. Sidebar e páginas reagem ao papel via `canRoute()` e `canAccess()`

### Headers Server-Side (futuro)

Quando JWT for implementado, o middleware Next.js setará:

- `x-silo-user-id`
- `x-silo-user-role`
- `x-silo-user-name`
- `x-silo-user-email`
- `x-silo-tenant`

APIs usam `resolveSessionUser(req)` para ler esses headers.

---

## 7. Regras de Validação

| Cenário | Resultado |
|---------|-----------|
| CONSULTA tenta POST /api/cadastro/operadores | 403 — cadastros/criar requer ADMIN_EMPRESA+ |
| COA faz POST /api/alertas/[id]/acknowledge | OK — alertas/reconhecer permitido para COA |
| COA tenta POST /api/admin/companies/token | 403 — administracao/administrar requer SUPER_ADMIN |
| GESTOR acessa /relatorios | OK — relatorios/visualizar permitido |
| GESTOR tenta DELETE /api/cadastro/operadores/[id] | 403 — cadastros/arquivar requer ADMIN_EMPRESA+ |
| AUDITOR acessa /administracao/empresas | Sidebar oculta — sem visualizar em administracao |
| AUDITOR acessa audit-log | OK — audit-log/visualizar permitido |

---

## 8. Limitações Atuais (Piloto)

1. **Sem JWT** — sessão baseada em localStorage. Headers de papel confiados internamente.
2. **requirePermission backward compat** — se nenhum header de sessão presente, a requisição é permitida (piloto). Usar `strict: true` para rejeitar.
3. **Sem troca de papel** — usuário tem papel fixo vinculado ao accessGroupId.
4. **SUPER_ADMIN cross-tenant** — atualmente SUPER_ADMIN vê apenas o tenant atual. Cross-tenant UI será implementado separadamente.
