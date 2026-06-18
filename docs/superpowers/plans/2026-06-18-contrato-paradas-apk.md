# ETAPA 6.8A — CONTRATO DE PARADAS APK

**Data:** 2026-06-18  
**Status:** ✅ Implementado e testado  
**Branch:** main  
**Commit:** `2a718cb fix: show stop reason on active operations`

---

## Objetivo

Formalizar e implementar o contrato de eventos de parada entre o APK Field e o SILO OPS Central, garantindo que a Central consuma corretamente os campos `stopReasonCode` e `stopReasonDescription` enviados pelo APK nos eventos de tipo `STOP_REASON`.

---

## Contexto

- O APK envia eventos com `type: STOP_REASON` contendo `stopReasonCode` e `stopReasonDescription`.
- Antes desta etapa, o campo `stopReasonDescription` não estava na cadeia de lookup de nenhum dos resolvers — `eventStopDesc()` em `resolve-active-operations.ts` e `eventDesc()` em `stop-resolver.ts`.
- Como consequência, a tela `/operacoes` exibia `CÓDIGO: 202` mas não o motivo `Sem Atividade Noturna`.
- Esta etapa corrige o resolver, expõe o estado semântico `ResolvedStop` na API `/api/operacoes/ativas` e renderiza o bloco PARADA corretamente em `/operacoes`.

---

## Arquivos alterados

- `lib/operational/resolve-active-operations.ts` — adicionado `stopReasonDescription` como primeiro lookup em `eventStopDesc()`; exportado `resolveStopFull()`
- `lib/stop-resolver.ts` — adicionado `stopReasonDescription` como primeiro lookup em `eventDesc()`
- `app/api/operacoes/ativas/route.ts` — adicionado `stop: ResolvedStop` ao `ActiveOperationItem`; preenchido via `resolveStopFull()` em todos os caminhos de construção de item
- `app/operacoes/page.tsx` — adicionado componente `StopBlock` que renderiza os 4 estados semânticos (`SEM_PARADA_ATIVA`, `AGUARDANDO_APONTAMENTO`, `PARADA_APONTADA`, `PARADA_INCONSISTENTE`)
- `app/api/operacoes/ativas/__tests__/route.test.ts` — adicionados 11 testes D.1 (H1–H13) + 8 testes D.2 (D2-H1–D2-H8); 32/32 passando

---

## Eventos implementados

| Evento          | Suportado | Campo de código       | Campo de descrição           |
|-----------------|-----------|-----------------------|------------------------------|
| `STOP_REASON`   | ✅         | `stopReasonCode`      | `stopReasonDescription`      |
| `PARADA_APONTADA` | ✅ (alias) | `stopCode`           | `stopDescription`            |
| `STOP_DETECTED` | ✅ (via live-state) | `stopCode`  | `stopDescription`            |
| `STOP_ENDED`    | ✅ (inferido via live-state) | —    | —                            |
| `STATUS_CHANGED`| ✅ (via live-state `status`) | —   | —                            |

---

## Pendências

- Rate limiting na rota `/api/mobile/events` (pendente de etapa anterior — ver SILO OPS Security Audit 2026-06-16)
- Teste E2E no APK para validar payload oficial em ambiente de homologação

---

## Critério de aprovação

- [x] 32/32 testes passando (`npx jest --testPathPattern=route.test`)
- [x] `tsc --noEmit` sem erros
- [x] Tela `/operacoes` exibe código e motivo da parada corretamente
- [x] Tela `/mapa-operacional` sem regressão (resolver compartilhado, não alterado em comportamento)
