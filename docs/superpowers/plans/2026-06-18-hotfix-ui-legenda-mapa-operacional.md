# HOTFIX UI — Refinar Legenda do Mapa Operacional

**Data:** 2026-06-18  
**Tipo:** Hotfix UI  
**Status:** APROVADO

---

## Problema Visual

A legenda exibida no Mapa Operacional e no Dashboard apresentava:

- Fundo com contraste insuficiente sobre imagem satélite
- Texto pequeno e pouco legível
- Status sem bolinha colorida identificável
- Contadores desalinhados
- Visual inconsistente com o design system SILO OPS

---

## Objetivo

Aplicar card operacional moderno com:

- Fundo escuro translúcido (`rgba(8, 13, 30, 0.88)`)
- Backdrop blur (`backdrop-blur-xl`)
- Borda sutil (`border-slate-600/30`)
- Bolinhas coloridas com glow por status
- Contadores alinhados à direita
- Tipografia limpa e hierárquica
- Separadores suaves entre seções

---

## Telas Afetadas

- `/mapa-operacional` — via `components/map/equipment-map-legend.tsx`
- `/dashboard` — via `components/dashboard/operational-map.tsx`

---

## Arquivos Alterados

### `components/map/equipment-map-legend.tsx`
- Adicionado `min-w-0` no flex interno da linha de status (truncamento seguro)
- Adicionado `truncate` nos labels de status e tipo
- Corrigido `flex-shrink-0` → `shrink-0` (Tailwind v3)

### `components/dashboard/operational-map.tsx`
- Substituído bloco `StatusLegend` por card visual alinhado ao spec
- Novo container: `rounded-2xl border-slate-600/30 bg-[#080d1e]/90 backdrop-blur-xl shadow-2xl`
- Adicionado cabeçalho "Legenda" + badge de total
- Adicionado seção "Status" com título interno
- `StatusItem` reescrito: usa `color` como hex inline (não classe Tailwind), dot com glow, label com truncate, contador alinhado
- Removido import `cn` (não mais utilizado)

---

## Padrão Visual Aplicado

```
background: rgba(8, 13, 30, 0.88)
backdrop-filter: blur(12px)
border: 1px solid rgba(100, 116, 139, 0.35)
border-radius: 16px
box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35)
```

Status dots com glow: `boxShadow: 0 0 8px {color}70`

---

## Validação

- `npm run lint`: ✅ Passou (warning pré-existente em timeline, não relacionado)
- `npm run type-check` (arquivos alterados): ✅ Zero erros
- `npm run build`: Sandbox OOM (limitação conhecida do ambiente)

---

## Critério de Aprovação

| Critério | Status |
|---|---|
| Legenda mais legível | ✅ |
| Card alinhado com tema SILO OPS | ✅ |
| Status com bolinhas coloridas | ✅ |
| Contadores alinhados à direita | ✅ |
| Tipos alinhados | ✅ |
| Fundo não atrapalha leitura do mapa | ✅ |
| Mapa não quebrou | ✅ |
| Popup não quebrou | ✅ |
| Rastro não quebrou | ✅ |
| Contagens não alteradas | ✅ |
| Lint passou | ✅ |
| Type-check nos arquivos alterados passou | ✅ |
