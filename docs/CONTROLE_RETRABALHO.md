# MEMÓRIA TÉCNICA E CONTROLE DE RETRABALHO
**Projeto:** SILO OPS Central v2  
**Objetivo:** Este documento serve como bússola para qualquer desenvolvedor ou IA, garantindo que decisões já validadas não sejam alteradas ou refatoradas sem necessidade, evitando desperdício de tempo.

---

## 1. Definições Inegociáveis (Core)
*   **Framework:** Next.js 14 (App Router).
*   **Estilização:** Tailwind CSS + Lucide Icons.
*   **Tipagem:** TypeScript (Strict Mode). Erros de `type-check` bloqueiam o projeto.
*   **Autenticação:** Atualmente via **Mock Local** (`lib/context/auth-context.tsx`). **Não implementar Firebase, Auth0 ou Backend externo** até ordem explícita na Etapa P2.
*   **Dados:** Persistência via `localStorage` simulando banco de dados. O `BaseService` gerencia o isolamento por `tenantId`.

---

## 2. Decisões de Arquitetura Validadas
*   **Isolamento de Dados:** Todo serviço herda de `BaseService`. O filtro por `tenantId` é automático e **não deve ser removido**.
*   **RBAC (Permissões):** A matriz de permissões está em `lib/mock/master-data.ts`. O componente `withAuth` protege rotas.
*   **Checklist Crítico:** Se um item crítico falha, o equipamento **deve** ser bloqueado. Esta lógica está no `ChecklistExecutionService`.

---

## 3. Fluxo Anti-Retrabalho
Antes de iniciar qualquer tarefa, verifique:
1.  **O arquivo já existe?** Não crie componentes duplicados. Verifique `@/components/shared`.
2.  **A lógica já existe?** Verifique `@/services/master.service.ts`.
3.  **A validação já existe?** Verifique `@/lib/validations/master-schemas.ts`.

---

## 4. Regras de Ouro (Proteção do Piloto)
1.  **Normalização de Login:** Sempre usar `email.trim().toLowerCase()`.
2.  **Layout:** Não alterar cores `#primary` ou o design "Dark/Cyberpunk" sem aprovação.
3.  **Build:** O projeto deve gerar 100% de páginas estáticas (`npm run build`). Se houver erro de "Dynamic usage", corrija a rota, não desabilite o build.

---

## 5. Histórico de Decisões Críticas
*   **04/06/2024:** Definida autenticação local com senhas em texto puro para a fase piloto (Simplicidade > Segurança Complexa no Dia 0).
*   **04/06/2024:** Estabelecida a **Regra Oficial de Validação** (Nenhum código sobe sem `type-check` e `build` aprovados).

---
*Este documento deve ser lido no início de cada sessão de desenvolvimento.*
