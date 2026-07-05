# Cadastros Mestres P4.16A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Padronizar visualmente os cadastros mestres reais do SILO OPS Central com acabamento premium, sem criar CRUD novo nem alterar backend.

**Architecture:** Vamos extrair apenas primitives visuais leves para reaproveitar o mesmo shell, toolbar, card-base e badge entre páginas que já existem. Cada rota mantém sua própria lógica, estado e serviços; o compartilhamento fica restrito a layout, densidade visual, empty states e ações de topo. Rotas ausentes não entram no fluxo funcional: ficam apenas como “Em preparação” nos atalhos.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, lucide-react.

---

### Task 1: Criar primitives visuais comuns

**Files:**
- Create: `components/master-data/master-data-shell.tsx`
- Create: `components/master-data/master-data-toolbar.tsx`
- Create: `components/master-data/master-data-card.tsx`
- Create: `components/master-data/master-data-status-badge.tsx`

- [ ] **Step 1: Implementar o shell premium**

```tsx
type MasterDataShellProps = {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function MasterDataShell({ title, description, actions, children }: MasterDataShellProps) {
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">{title}</h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{description}</p>
            </div>
            {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar toolbar reutilizável**

```tsx
type MasterDataToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  actions?: React.ReactNode;
};

export function MasterDataToolbar({ search, onSearchChange, searchPlaceholder, actions }: MasterDataToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
      <div className="relative flex-1">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-4 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner"
        />
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 3: Implementar card e badge**

```tsx
export function MasterDataCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 transition-all overflow-hidden">{children}</div>;
}
```

```tsx
const STATUS_MAP = {
  ATIVO: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  INATIVO: 'bg-red-500/10 text-red-400 border-red-500/20',
  PADRAO: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
};
```

### Task 2: Aplicar shell nas páginas reais

**Files:**
- Modify: `app/equipamentos/page.tsx`
- Modify: `app/operadores/page.tsx`
- Modify: `app/operacoes/page.tsx`
- Modify: `app/fazendas-talhoes/page.tsx`
- Modify: `app/combustivel/produtos/page.tsx`
- Modify: `app/combustivel/comboios/page.tsx`

- [ ] **Step 1: Trocar o container raiz para o shell compartilhado**
- [ ] **Step 2: Substituir as barras de busca por toolbar padronizada onde fizer sentido**
- [ ] **Step 3: Envolver cards/tabelas no card-base sem alterar lógica**
- [ ] **Step 4: Manter ações existentes e apenas ajustar aparência/spacing**

### Task 3: Marcar rotas ausentes como preparação

**Files:**
- Modify only if houver menu/atalho apontando para rota inexistente

- [ ] **Step 1: Trocar links diretos para `Em preparação` ou rota equivalente existente**
- [ ] **Step 2: Evitar criar página fake ou backend novo**

### Task 4: Validar e fechar

**Files:**
- No code changes

- [ ] **Step 1: Run `npm run type-check`**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Review `git diff --cached --stat` to confirm only intended pages/components changed**
- [ ] **Step 4: Commit only after validation passes**
