# Equipamentos Operacionais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar `/equipamentos` para leitura equilibrada, com prioridade operacional/comercial, sem alterar backend, banco, auth, tenant ou contratos mobile.

**Architecture:** A página continuará consumindo os mesmos serviços e modelagens já existentes. Vamos reorganizar a camada de apresentação em três blocos: visão executiva no topo, cards/lista com leitura operacional primeiro, e drawer/formulário com labels/agrupamento mais claros. Se houver necessidade real, extrairemos pequenos helpers visuais em componentes já existentes de master-data; nada de refatoração ampla.

**Tech Stack:** Next.js 14, React, TypeScript, react-hook-form, Zod, Tailwind utility classes, lucide-react.

---

### Task 1: Mapear dados reais e preservar contrato

**Files:**
- Modify: `app/equipamentos/page.tsx`
- Read-only reference: `lib/types/index.ts`, `lib/validations/master-schemas.ts`, `components/master-data/master-data-shell.tsx`, `components/master-data/master-data-toolbar.tsx`, `components/master-data/master-data-status-badge.tsx`

- [ ] **Step 1: Confirm fields already available**

```ts
// Confirmar uso apenas de campos existentes em Equipment/EquipmentFormData:
// code, typeId, modelId, brand, plateOrSerial, status, hourmeter,
// observations, mobileEnabled, lastSignal, lastSyncAt, deviceId, trackerId
```

- [ ] **Step 2: Define display order**

```ts
// Ordem visual:
// 1) code/frota
// 2) type + model
// 3) status + frente
// 4) mobile + telemetria
// 5) lastSignal/lastSyncAt
// 6) suporte técnico: horímetro/KM, deviceId/trackerId
```

### Task 2: Refatorar a tela para visão equilibrada operacional/comercial

**Files:**
- Modify: `app/equipamentos/page.tsx`

- [ ] **Step 1: Reestruturar header e KPI placeholders com dados existentes**

```tsx
<MasterDataShell
  title="Frota Operacional"
  description="Gestão técnica e monitoramento de ativos agrícolas"
  actions={<button>Novo Equipamento</button>}
>
```

- [ ] **Step 2: Exibir cards com leitura operacional primeiro**

```tsx
// Em cada card:
// - Frota/código
// - Tipo / modelo
// - Status ativo/inativo
// - Frente ou "Não informado"
// - Mobile: Habilitado / Não habilitado
// - Telemetria: Ativa / Sem vínculo / Não configurada
// - Último sinal: Agora / há X min / não informado
// - Horímetro/KM como apoio técnico
```

- [ ] **Step 3: Melhorar filtros sem inventar lógica nova**

```tsx
<MasterDataToolbar
  searchPlaceholder="Buscar por frota, código, tipo ou modelo..."
  actions={...}
/>
// Manter busca atual; filtros visuais adicionais só se já houver estado pronto.
```

- [ ] **Step 4: Empty state comercial**

```tsx
// Título:
// "Nenhum equipamento cadastrado"
// Descrição:
// "Cadastre frotas e equipamentos para iniciar jornadas, telemetria, abastecimentos e rastreio operacional."
// CTA: "Novo Equipamento" ou "Integrar Equipamento"
```

### Task 3: Ajustar formulário/drawer sem mudar backend

**Files:**
- Modify: `app/equipamentos/page.tsx`

- [ ] **Step 1: Reorganizar labels e placeholders**

```tsx
// Labels visíveis:
// Código da frota
// Descrição
// Tipo
// Modelo
// Frente
// Status
// Mobile habilitado
// Telemetria habilitada
// Horímetro inicial / KM inicial
```

- [ ] **Step 2: Manter payload atual**

```ts
// Não criar campos novos no submit.
// Persistir apenas o que o EquipmentFormData e o service já suportam.
```

- [ ] **Step 3: Melhorar feedback visual**

```tsx
// Usar badges para:
// - Mobile habilitado
// - Aguardando vínculo
// - Telemetria ativa
// - Sem sinal
// - Último sinal
```

### Task 4: Verificação e commit controlado

**Files:**
- Modify: `app/equipamentos/page.tsx`

- [ ] **Step 1: Rodar type-check**

```bash
npm run type-check
```

- [ ] **Step 2: Rodar build**

```bash
npm run build
```

- [ ] **Step 3: Stage controlado**

```bash
git restore --staged .
git add app/equipamentos/page.tsx
git diff --cached --stat
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: refine equipment operational view"
git push origin main
```

## Self-review coverage

- UI commercial/operacional: Task 2
- KPIs/filtros/cards: Task 2
- Drawer/form labels: Task 3
- No backend/API/banco/tenant/mobile changes: Tasks 1–3 preserve existing services/contracts
- Validation and commit discipline: Task 4
