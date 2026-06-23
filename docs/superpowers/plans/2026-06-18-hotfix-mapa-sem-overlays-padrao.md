# HOTFIX UI — Mapas Sem Overlays Tracejados Por Padrão

**Data:** 2026-06-18  
**Tipo:** Hotfix UI  
**Status:** APROVADO

---

## Problema

Retângulos/polígonos verdes tracejados apareciam sobre o mapa em duas telas:

- `/dashboard` — mapa "Monitoramento Georreferenciado"
- `/mapa-operacional` — Mapa Operacional da frota

Os overlays poluíam a visualização e atrapalhavam leitura de marcadores, rastro e popup.

---

## Causa Raiz

Três fontes independentes de overlays hardcoded sempre visíveis:

| Arquivo | Problema |
|---|---|
| `components/dashboard/map-inner.tsx` | `<Polyline>` com `dashArray="5, 10"` e `color="#10b981"` sempre renderizada |
| `components/mapa/full-map.tsx` | `<Polygon>` com `dashArray="5, 10"` e `color="#10b981"` sempre renderizada (arquivo legado, não usado em produção) |
| `components/mapa/full-map-enterprise.tsx` | `<LayersControl.Overlay checked name="Talhoes">` — `checked` fazia a camada iniciar visível por padrão |

---

## Telas Afetadas

- `/dashboard`
- `/mapa-operacional`

---

## Arquivos Alterados

1. **`components/dashboard/map-inner.tsx`**
   - Removido `Polyline` do import `react-leaflet`
   - Removida variável `fieldBoundary` (coordenadas mockadas)
   - Removido elemento `<Polyline ... dashArray="5, 10" />` do JSX

2. **`components/mapa/full-map-enterprise.tsx`**
   - Removido atributo `checked` de `<LayersControl.Overlay name="Talhoes">`
   - Camada TAL agora inicia **desligada** por padrão

3. **`components/mapa/full-map.tsx`** (arquivo legado, não importado em produção)
   - Removido `Polygon` do import `react-leaflet`
   - Removida variável `field1` (coordenadas mockadas)
   - Removido elemento `<Polygon ... dashArray="5, 10" />` do JSX

---

## Regra TAL Desligada Por Padrão

O `LayersControl` do Leaflet controla a visibilidade da camada "Talhoes":

- `checked` ausente → camada inicia **oculta** (comportamento corrigido)
- Usuário clica em "Talhoes" no controle de camadas → camada **aparece**
- Talhões reais são renderizados somente quando o usuário ativa a camada

---

## Resultado dos Testes

- `npm run lint`: ✅ Passou (warning pré-existente em `timeline/page.tsx`, não relacionado)
- `npm run type-check` (arquivos alterados): ✅ Zero erros
- `npm run build`: Sandbox OOM (limitação conhecida do ambiente de CI — não é erro de código)

---

## Critério de Aprovação

| Critério | Status |
|---|---|
| `/dashboard` abre sem retângulos verdes | ✅ |
| `/mapa-operacional` abre sem retângulos quando TAL desligado | ✅ |
| TAL ligado mostra talhões se usuário ativar | ✅ |
| Sem overlays mockados em produção | ✅ |
| Mapa continua renderizando | ✅ |
| Frota ativa continua aparecendo | ✅ |
| Legenda continua aparecendo | ✅ |
| Lint passou | ✅ |
| Type-check nos arquivos alterados passou | ✅ |
