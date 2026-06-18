# CHANGELOG — SILO OPS Central

Histórico de alterações significativas por etapa. Versões seguem o padrão interno `MAJOR.MINOR.PATCH`.

---

## [6.8A] — 2026-06-18 — ETAPA 6.8A: CONTRATO DE PARADAS APK

**Commit:** `2a718cb fix: show stop reason on active operations`

### Adicionado

- `stop: ResolvedStop` no retorno de `/api/operacoes/ativas` — objeto semântico com `state`, `code`, `reason`, `source`, `inconsistency`
- Componente `StopBlock` em `app/operacoes/page.tsx` — renderiza os 4 estados semânticos de parada (`SEM_PARADA_ATIVA`, `AGUARDANDO_APONTAMENTO`, `PARADA_APONTADA`, `PARADA_INCONSISTENTE`)
- Campo `stopReasonDescription` na cadeia de lookup de `eventStopDesc()` em `lib/operational/resolve-active-operations.ts`
- Campo `stopReasonDescription` na cadeia de lookup de `eventDesc()` em `lib/stop-resolver.ts`
- Suporte aos eventos APK: `STOP_REASON`, `stopReasonCode`, `stopReasonDescription`, `PARADA_APONTADA`, `STOP_DETECTED`, `STOP_ENDED`, `STATUS_CHANGED`
- 19 novos testes de unidade (11 D.1 + 8 D.2); total 32/32 passando

### Corrigido

- Tela `/operacoes` exibia `CÓDIGO: 202` mas não o motivo — agora exibe código e descrição juntos
- Tela `/operacoes` não mostrava estado semântico de parada — agora usa o mesmo resolver aprovado no `/mapa-operacional`
- `resolveStopFull()` não era exportado — agora é `export function resolveStopFull()`

### Sem regressão

- Tela `/mapa-operacional` — reutiliza o mesmo resolver, comportamento inalterado
- Campos flat `stopCode` / `stopDescription` mantidos no `ActiveOperationItem` para compatibilidade retroativa

---

## [6.7D] — 2026-06-17/18 — Hotfixes de parada nas Operações Ativas

**Commits:**
- `fix: show resolved stop state on active operations` (6.7D.1)
- `fix: show stop reason on active operations` (6.7D.2)

### Hotfix 6.7D.1

- Adicionado `resolveStopFull()` à rota `/api/operacoes/ativas`
- Tela `/operacoes` substituiu bloco condicional `{item.stopCode ? ...}` por `<StopBlock stop={item.stop} />`

### Hotfix 6.7D.2

- Adicionado `stopReasonDescription` como primeiro campo nas cadeias de lookup dos dois resolvers
- Testes D2-H1 a D2-H8 cobrem o campo canônico do APK

---

## [Anteriores]

Para histórico anterior, consultar:
- `docs/STATUS.md`
- `docs/ROADMAP.md`
- `docs/AUDITORIA_TECNICA_2026-06-13.md`
- `docs/superpowers/plans/` — planos por data
