# Plano de Implementação: Timeline Operacional com Eventos Reais

## HOTFIX 6.8D.1 — TIMELINE OPERACIONAL COM EVENTOS REAIS DO APK

**Data:** 18/06/2026
**Status:** IMPLEMENTADO

### Problema Encontrado
A tela Timeline Operacional estava vazia (`NENHUM EVENTO REGISTRADO NO PERÍODO`), mesmo existindo rastro, operações ativas e eventos sincronizados no storage.

### Causa Raiz
A Timeline estava consumindo apenas a entidade `timeline` do `CadastroStorage`, que é destinada a eventos manuais/cadastrados, ignorando o fluxo real de eventos mobile vindos do APK em `mobile-events.json`.

### Fontes de Dados Usadas
- `mobile-events.json`: Eventos brutos recebidos via `/api/mobile/events/batch`.
- `live-state.json`: Estado atual para enriquecimento (fallback).
- `trails/`: Rastro da jornada para pontos GPS (integrado via mobile-events).

### Eventos Suportados
- `JOURNEY_START` / `JOURNEY_END`
- `GPS_POINT` / `LOCATION`
- `HEARTBEAT`
- `STOP_DETECTED` / `STOP_REASON` / `STOP_ENDED`
- `STATUS_CHANGED`
- `CHECKLIST`
- `FUELING`
- `SYNC_ERROR`
- `OPERATION_SELECTED` / `OPERATION_CHANGED`

### Filtros Implementados
- `tenantId` (isolamento obrigatório)
- `fleetCode` (código da frota)
- `equipmentId` (ID interno)
- `operatorRegistration` (matrícula)
- `journeyId` (ID da jornada ativa)
- `intervalo de data` (startDate/endDate)

### Arquivos Alterados
- `lib/mobile-events-store.ts`: Abstração de leitura de eventos mobile.
- `lib/equipment-trail-store.ts`: Abstração de leitura de rastro.
- `lib/timeline.ts`: Agregador e mapeador de eventos para a UI.
- `app/api/timeline/route.ts`: Nova rota de API agregada.
- `app/api/eventos/route.ts`: Rota de exportação de eventos brutos.
- `services/api-service.ts`: Redirecionamento do `TimelineService`.
- `app/operacoes/timeline/page.tsx`: UI atualizada com novos filtros e suporte a eventos reais.

### Testes Executados
1. Validado que a Timeline lê eventos de `mobile-events.json`.
2. Validado filtro por `fleetCode` (Frota 2026).
3. Validado filtro por `journeyId`.
4. Validado ordenação decrescente por timestamp.
5. Validado mapeamento de `STOP_REASON` com código e descrição.
6. Validado visualização de `GPS_POINT` e `HEARTBEAT`.
7. Validado "Empty State" inteligente (mensagem útil quando há filtros ativos).

### Resultado do Build
- `npm run lint`: PASS
- `npm run type-check`: PASS
- `npm run build`: PASS

### Critério de Aprovação
- [x] Timeline mostra eventos reais da frota 2026.
- [x] Filtros por frota e jornada funcionam.
- [x] Eventos de parada aparecem corretamente.
- [x] Não quebra com payloads incompletos.
- [x] Mapa e Rastro continuam funcionando.
