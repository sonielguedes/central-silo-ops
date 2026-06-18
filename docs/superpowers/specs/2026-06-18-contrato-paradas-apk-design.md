# SPEC: Contrato de Paradas APK — Design Técnico

**Etapa:** 6.8A  
**Data:** 2026-06-18  
**Status:** ✅ Implementado  
**Plano relacionado:** `plans/2026-06-18-contrato-paradas-apk.md`

---

## Objetivo

Definir o contrato canônico de eventos de parada entre o APK Field (Android) e o SILO OPS Central (Next.js), especificando:
- Estrutura oficial do payload de cada evento
- Regras de outbox (APK → Central)
- Regras de idempotência
- Regras de formatação de matrícula e frota
- Como o Central resolve o estado semântico de parada

---

## Payload Oficial do Evento `STOP_REASON`

```json
{
  "type": "STOP_REASON",
  "tenantId": "sg01-1781359594113",
  "equipmentId": "eq-2026",
  "timestamp": "2026-06-18T01:00:00.000Z",
  "payload": {
    "status": "PARADA_APONTADA",
    "fleetCode": "T-15",
    "equipmentCode": "eq-2026",
    "operatorRegistration": "12345",
    "journeyId": "5752f4a7-286d-4148-bf40-dd8c69d656a4",
    "stopReasonCode": "202",
    "stopReasonDescription": "Sem Atividade Noturna"
  }
}
```

### Campos obrigatórios

| Campo                        | Tipo   | Descrição                                                    |
|------------------------------|--------|--------------------------------------------------------------|
| `type`                       | string | Sempre `"STOP_REASON"` para apontamento de parada            |
| `tenantId`                   | string | ID do tenant (empresa) — string, nunca número               |
| `equipmentId`                | string | ID do equipamento — string, nunca número                    |
| `timestamp`                  | string | ISO 8601 UTC (`Z`). Hora local do APK convertida para UTC    |
| `payload.status`             | string | Estado semântico: `PARADA_APONTADA`                          |
| `payload.stopReasonCode`     | string | Código do motivo de parada (ex: `"202"`) — **sempre string** |
| `payload.stopReasonDescription` | string | Descrição legível (ex: `"Sem Atividade Noturna"`)         |

### Campos opcionais recomendados

| Campo                        | Tipo   | Descrição                                                    |
|------------------------------|--------|--------------------------------------------------------------|
| `payload.fleetCode`          | string | Código de frota — **string** (ex: `"T-15"`, não `15`)       |
| `payload.equipmentCode`      | string | Espelho de `equipmentId` para correlação                     |
| `payload.operatorRegistration` | string | Matrícula do operador — **string** (ex: `"12345"`, não `12345`) |
| `payload.journeyId`          | string | UUID da jornada ativa                                        |

---

## Regras de Outbox (APK → Central)

1. O APK persiste o evento localmente em SQLite antes de tentar transmitir.
2. A transmissão usa a rota `POST /api/mobile/events` com `X-Company-Token`.
3. Retry automático com backoff exponencial enquanto offline.
4. Após ACK da Central (HTTP 200/201), o evento é marcado como `sent` na fila local.
5. Eventos da fila **nunca são deletados** — apenas marcados como enviados, para auditoria.
6. Ordem de envio: FIFO por `timestamp` dentro da mesma `journeyId`.

---

## Regras de Idempotência

- A Central usa `(tenantId + equipmentId + timestamp + type)` como chave de deduplicação.
- Reenvios do mesmo evento (mesmo timestamp) são ignorados silenciosamente (HTTP 200, não 409).
- O live-state é atualizado apenas se o `timestamp` do evento for ≥ ao `timestamp` do estado atual.
- Eventos com `timestamp` anterior ao estado atual são armazenados mas não alteram o live-state.

---

## Regras de Matrícula (String)

- `operatorRegistration` **sempre como string** no payload do APK.
- A Central trata como string em todos os resolvers (`asStr()`).
- Nunca comparar como número — o APK pode enviar `"0012345"` com zeros à esquerda.
- Lookup no cadastro: `catalog.find(op => op.registration === reg)` (igualdade de string).

---

## Regras de Frota (String)

- `fleetCode` / `equipmentCode` **sempre como string** no payload.
- Formato livre definido pelo tenant (ex: `"T-15"`, `"CAM-003"`, `"42"`).
- O live-state indexa por `fleetCode` (string). Nunca converter para número.
- Matching case-sensitive: `"T-15" !== "t-15"`.

---

## Estados Semânticos de Parada

O resolver `resolveStopFull()` em `lib/operational/resolve-active-operations.ts` produz um `ResolvedStop` com os seguintes estados:

| `StopState`              | Condição                                                           | Exibição na UI              |
|--------------------------|--------------------------------------------------------------------|-----------------------------|
| `SEM_PARADA_ATIVA`       | `liveStatus` não indica parada / nenhum evento de parada          | Cinza — "Sem parada ativa"  |
| `AGUARDANDO_APONTAMENTO` | `liveStatus` indica parada (`PARADO`, `AGUARDANDO_PARADA`) mas nenhum código apontado | Âmbar — "Aguardando apontamento" |
| `PARADA_APONTADA`        | Evento `STOP_REASON` ou `PARADA` com `stopReasonCode` presente    | Laranja — código + motivo   |
| `PARADA_INCONSISTENTE`   | Dados de parada contraditórios ou malformados                     | Vermelho — inconsistência   |

### Cadeia de prioridade do resolver

```
1. Evento mais recente do tipo STOP_REASON (campos: stopReasonCode, stopReasonDescription)
2. Evento mais recente do tipo PARADA (campos: stopCode, stopDescription, stopReason)
3. Live-state (campos: stopCode, stopDescription, stopReason)
4. Catálogo de paradas do cadastro (lookup por código)
5. SEM_PARADA_ATIVA se nenhuma fonte disponível
```

---

## Testes Executados

### Hotfix 6.7D.1 — Estado semântico na tela /operacoes (11 testes)

| ID    | Cenário                                                          | Resultado |
|-------|------------------------------------------------------------------|-----------|
| H1    | Item sem parada → StopBlock mostra SEM_PARADA_ATIVA              | ✅ PASS   |
| H2    | Item com liveStatus PARADO e sem código → AGUARDANDO_APONTAMENTO  | ✅ PASS   |
| H3    | Item com evento STOP_REASON com código → PARADA_APONTADA         | ✅ PASS   |
| H4    | API retorna campo `stop` com `state`, `code`, `reason`           | ✅ PASS   |
| H5–H13| Outros cenários de estado semântico e regressão                  | ✅ PASS   |

### Hotfix 6.7D.2 — Exibição do motivo (stopReasonDescription) (8 testes)

| ID     | Cenário                                                         | Resultado |
|--------|-----------------------------------------------------------------|-----------|
| D2-H1  | Evento STOP_REASON com stopReasonDescription preenche `reason`  | ✅ PASS   |
| D2-H2  | `stop.reason === 'Sem Atividade Noturna'`                       | ✅ PASS   |
| D2-H3  | Código `202` presente                                           | ✅ PASS   |
| D2-H4  | `state === 'PARADA_APONTADA'`                                   | ✅ PASS   |
| D2-H5  | stopDescription como fallback quando stopReasonDescription ausente | ✅ PASS |
| D2-H6  | stopReason como segundo fallback                                | ✅ PASS   |
| D2-H7  | Catalogo como fallback final                                    | ✅ PASS   |
| D2-H8  | Ausência de todos os campos → reason null                       | ✅ PASS   |

**Total: 32/32 testes passando**

---

## Resultado do Build

```
$ npx tsc --noEmit
(sem erros)

$ npx jest --testPathPattern=route.test
Tests: 32 passed, 32 total
```

---

## Escopo desta etapa

**Incluso:**
- Resolver de parada com `stopReasonDescription` na Central
- API `/api/operacoes/ativas` expondo `stop: ResolvedStop`
- Tela `/operacoes` com `StopBlock` semântico
- Tela `/mapa-operacional` (reutiliza o mesmo resolver — sem alteração necessária)

**Não incluso (próximas etapas):**
- Validação do payload no lado APK (responsabilidade do repositório Android)
- Persistência de histórico de paradas (banco de dados persistente)
- Dashboard de análise de paradas por motivo
- Rate limiting em `/api/mobile/events`
