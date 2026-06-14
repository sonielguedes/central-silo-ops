# P0 — Validação: Horímetro Limpo em Nova Jornada

**Papel:** Engenheiro Android Sênior + Arquiteto de Integração + Arquiteto Backend  
**Objetivo:** Garantir que, após o saneamento do live-state (remoção de `hourmeterStart/current = 0`), uma nova jornada propagha horímetro correto do APK até a API Central — sem valores zerados, sem inconsistência.

---

## 1. Análise do Backend (Central SILO OPS)

### 1.1 Camada de Saneamento — `sanitizeLiveStateItem()`

`lib/server-storage.ts` — chamada a **cada leitura** do live-state:

```
hourmeter, hourmeterInitial, hourmeterStart, hourmeterCurrent,
hourmeterFinal, hourmeterEnd   →   removidos se valor <= 0 ou não-finito

totalHourmeter                 →   removido se < 0 ou não-finito

hourmeterEnd sem hourmeterStart válido  →  hourmeterInconsistent = true
hourmeterEnd < hourmeterStart           →  hourmeterEnd deletado + inconsistent = true
hourmeterCurrent < hourmeterStart       →  hourmeterCurrent deletado
```

> **Garantia:** nenhum valor `= 0` jamais persiste em disco ou é retornado pelo `/api/equipamentos/status`.

### 1.2 Filtro de Updates — `updateLiveState()`

Antes de gravar qualquer campo de horímetro:

```typescript
if (value <= 0) return false;                         // descarta <= 0
if (key === 'hourmeterCurrent' && value < hourmeterStart) return false;  // descarta regressão
if (key === 'hourmeterEnd'     && value < hourmeterStart) return false;  // descarta inválido
```

### 1.3 Handler JOURNEY_START (`/api/mobile/events/batch`)

```typescript
case 'JOURNEY_START': {
  const hStart = asValidHourmeter(d.hourmeterStart ?? d.hourmeter); // aceita somente > 0
  if (hStart != null) {
    liveUpdates.hourmeterStart   = hStart;
    liveUpdates.hourmeterCurrent = hStart;   // ← inicializa current = start
  }
  // hourmeterSource via applyOperationalFields
}
```

**Log emitido pelo servidor:**
```
[Hourmeter] source=MANUAL
[Hourmeter] start=88
[Hourmeter] current=88
```

### 1.4 Handler JOURNEY_END

```typescript
case 'JOURNEY_END': {
  if (hEnd < hStart) {
    liveUpdates.hourmeterInconsistent = true;
    liveUpdates.hourmeterInconsistencyReason = 'hourmeterEnd menor que hourmeterStart';
    // hourmeterEnd NÃO é salvo
  }
  // Persiste: hourmeterStart, hourmeterEnd (só se válido), totalHourmeter, hourmeterSource
}
```

### 1.5 Endpoint de Consulta

`GET /api/equipamentos/status` → `getLiveFleet()` → `loadLiveState()` → **sanitiza sempre na leitura**.  
Mesmo que dados legados existam em disco, a resposta será sempre saneada.

---

## 2. Pré-condições

| # | Ação | Responsável |
|---|------|-------------|
| 1 | Limpar dados do APK (Configurações → Armazenamento → Limpar dados) | Tester |
| 2 | Confirmar que `live-state.json` no servidor não contém `hourmeterStart=0` | DevOps |
| 3 | Verificar que frota **1002** (emulador) e **1000** (celular real) existem como `mobileEnabled=true` | Backend |
| 4 | Confirmar `companyToken` e `mobileToken` corretos nas instâncias de teste | Backend |

**Verificar live-state antes do teste:**
```bash
curl -s "https://api.siloops.com.br/api/equipamentos/status" \
  | jq '.[] | select(.fleetCode == "1000" or .fleetCode == "1002") | {fleetCode, hourmeterStart, hourmeterCurrent}'
```
Esperado: campos `hourmeterStart`/`hourmeterCurrent` **ausentes** ou **> 0** (nunca `= 0`).

---

## 3. Procedimento de Teste

### Passo 1 — Iniciar Jornada com Horímetro 88

No APK (emulador fleetCode=1002 ou celular fleetCode=1000):

1. Abrir jornada
2. Inserir horímetro inicial: **88**
3. Confirmar source: **MANUAL**

**Payload esperado no Outbox:**
```json
{
  "type": "JOURNEY_START",
  "data": {
    "fleetCode": "1002",
    "hourmeterStart": 88,
    "hourmeterCurrent": 88,
    "hourmeterSource": "MANUAL",
    "journeyId": "<uuid>"
  }
}
```

**Logcat APK esperado:**
```
[Hourmeter] source=MANUAL
[Hourmeter] start=88
[Hourmeter] current=88
[Outbox] JOURNEY_START PENDING created
[SyncRepository] HTTP=200
```

### Passo 2 — Confirmar no Servidor (Logcat / logs da Central)

Ao receber o batch, o servidor emite:
```
[Hourmeter] source=MANUAL
[Hourmeter] start=88
[Hourmeter] current=88
[Hourmeter] end=missing
[live-state] hourmeter updated fleetCode=1002
```

### Passo 3 — Aguardar Sync Automático e Verificar API

```bash
curl -s "https://api.siloops.com.br/api/equipamentos/status" \
  | jq '.[] | select(.fleetCode == "1002") | {
      fleetCode,
      status,
      hourmeterStart,
      hourmeterCurrent,
      hourmeterEnd,
      hourmeterSource,
      hourmeterInconsistent,
      hourmeterInconsistencyReason
    }'
```

**Resultado esperado:**
```json
{
  "fleetCode": "1002",
  "status": "ONLINE",
  "hourmeterStart": 88,
  "hourmeterCurrent": 88,
  "hourmeterSource": "MANUAL",
  "hourmeterInconsistent": null
}
```

**Critérios obrigatórios:**
- `hourmeterStart = 88` ✅
- `hourmeterCurrent >= 88` ✅
- `hourmeterSource = "MANUAL"` ✅
- `hourmeterInconsistent` ausente ou `false` ✅
- Campos `hourmeterStart`/`hourmeterCurrent` **nunca retornam `0`** ✅

### Passo 4 — Heartbeat (atualizar horímetro corrente)

APK envia heartbeat após alguns minutos. Payload esperado:
```json
{
  "type": "HEARTBEAT",
  "data": {
    "hourmeterCurrent": 88,
    "hourmeterSource": "MANUAL"
  }
}
```

Re-verificar a API:
```bash
curl -s "https://api.siloops.com.br/api/equipamentos/status" \
  | jq '.[] | select(.fleetCode == "1002") | {hourmeterStart, hourmeterCurrent}'
```
Esperado: `hourmeterCurrent >= 88` e nunca `0`.

### Passo 5 — Finalizar Jornada

No APK, inserir horímetro final: **88** ou **89**.

**Payload esperado:**
```json
{
  "type": "JOURNEY_END",
  "data": {
    "fleetCode": "1002",
    "hourmeterStart": 88,
    "hourmeterEnd": 89,
    "totalHourmeter": 1,
    "hourmeterSource": "MANUAL"
  }
}
```

**Regra de bloqueio no APK (OBRIGATÓRIA):**
```
if (hourmeterEnd < hourmeterStart) {
    // Bloquear envio — mostrar erro ao operador
    // NÃO criar evento JOURNEY_END no Outbox
}
```

**Verificação final na API:**
```bash
curl -s "https://api.siloops.com.br/api/equipamentos/status" \
  | jq '.[] | select(.fleetCode == "1002") | {
      fleetCode,
      status,
      hourmeterStart,
      hourmeterCurrent,
      hourmeterEnd,
      totalHourmeter,
      hourmeterSource,
      hourmeterInconsistent,
      hourmeterInconsistencyReason
    }'
```

**Resultado esperado:**
```json
{
  "fleetCode": "1002",
  "status": "OFFLINE",
  "hourmeterStart": 88,
  "hourmeterCurrent": 88,
  "hourmeterEnd": 89,
  "totalHourmeter": 1,
  "hourmeterSource": "MANUAL",
  "hourmeterInconsistent": null
}
```

---

## 4. Cenário Negativo — JOURNEY_END com end < start

**Objetivo:** Confirmar que bloqueio duplo funciona (APK + Backend).

1. Tentar inserir horímetro final = **80** (menor que start=88)
2. **APK deve bloquear** antes de enviar — erro visível ao operador
3. Se por algum motivo chegar ao servidor, o servidor:
   - Marca `hourmeterInconsistent = true`
   - NÃO salva `hourmeterEnd`
   - Registra: `hourmeterInconsistencyReason = 'hourmeterEnd menor que hourmeterStart'`

**Verificação:**
```bash
curl -s "https://api.siloops.com.br/api/equipamentos/status" \
  | jq '.[] | select(.fleetCode == "1002") | {hourmeterEnd, hourmeterInconsistent, hourmeterInconsistencyReason}'
```
Esperado: `hourmeterEnd` ausente, `hourmeterInconsistent = true`.

---

## 5. Script Completo de Verificação VPS

```bash
#!/bin/bash
# Verificacao completa de frota
BASE_URL="https://api.siloops.com.br"

echo "=== STATUS COMPLETO DA FROTA ==="
curl -s "$BASE_URL/api/equipamentos/status" | jq '.[] | {
  fleetCode,
  status,
  hourmeterStart,
  hourmeterCurrent,
  hourmeterEnd,
  hourmeterSource,
  hourmeterInconsistent,
  hourmeterInconsistencyReason
}'

echo ""
echo "=== EQUIPAMENTOS COM HORÍMETRO ZERADO (deve ser VAZIO) ==="
curl -s "$BASE_URL/api/equipamentos/status" | jq '[.[] | select(
  .hourmeterStart == 0 or
  .hourmeterCurrent == 0 or
  .hourmeterEnd == 0
)]'

echo ""
echo "=== EQUIPAMENTOS INCONSISTENTES (deve ser VAZIO) ==="
curl -s "$BASE_URL/api/equipamentos/status" | jq '[.[] | select(
  .hourmeterInconsistent == true
)]'
```

---

## 6. Critério de Aprovação P0

| Critério | Verificação | Status |
|----------|-------------|--------|
| `hourmeterStart = 88` na API | `jq .hourmeterStart` | ☐ |
| `hourmeterCurrent >= 88` na API | `jq .hourmeterCurrent` | ☐ |
| `hourmeterSource = "MANUAL"` | `jq .hourmeterSource` | ☐ |
| `hourmeterInconsistent` ausente/false | `jq .hourmeterInconsistent` | ☐ |
| Nunca `hourmeterStart=0` ou `current=0` | Script negativo | ☐ |
| Logcat APK: `[Hourmeter] source=MANUAL` | Logcat Android Studio | ☐ |
| Logcat APK: `[SyncRepository] HTTP=200` | Logcat Android Studio | ☐ |
| JOURNEY_END contém `hourmeterStart`, `hourmeterEnd`, `totalHourmeter`, `hourmeterSource` | Logcat/Network | ☐ |
| Bloqueio APK quando `end < start` | Teste manual | ☐ |
| Backend rejeita `hourmeterEnd < hourmeterStart` | API + jq | ☐ |

> **Aprovado somente se TODOS os 10 critérios forem atendidos.**

---

## 7. Análise de Risco

### Risco 1 — APK não envia `hourmeterStart` no JOURNEY_START
**Mitigação:** Backend usa `asValidHourmeter(d.hourmeterStart ?? d.hourmeter)` — fallback para campo `hourmeter`. Verificar que o APK popula ao menos um dos dois.

### Risco 2 — APK não envia `hourmeterSource` no JOURNEY_START  
**Mitigação:** Campo é opcional no backend — não bloqueia, mas `hourmeterSource` ficará ausente na API. APK deve sempre enviar `hourmeterSource: "MANUAL"` quando hourímetro for inserido manualmente.

### Risco 3 — Dados legados em `live-state.json` na VPS  
**Mitigação:** `loadLiveState()` sanitiza **na leitura** — qualquer valor `<= 0` é removido antes de retornar. **Porém**, se o arquivo em disco contém `hourmeterStart: 0`, ele será removido, e a próxima jornada iniciará sem `hourmeterStart` residual. ✅

### Risco 4 — `hourmeterCurrent` regride durante heartbeat
**Mitigação:** `updateLiveState()` descarta `hourmeterCurrent` se `value < hourmeterStart`. ✅

### Risco 5 — Race condition: múltiplos eventos no mesmo batch
**Mitigação:** Batch processa eventos em **ordem cronológica** (`sorted = [...events].sort(...)`). Último evento de horímetro vence. ✅

---

*Gerado por: Arquitetura SILO OPS — Engenharia Android + Integração + Backend*  
*Data: 2026-06-07*
