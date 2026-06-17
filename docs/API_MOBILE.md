# API Mobile — SILO OPS

**Base URL:** `https://{apiBaseUrl}/api/mobile`  
**Autenticação:** `X-Company-Token` (header obrigatório em todas as rotas, exceto health)  
**Data:** 2026-06-16  

---

## Autenticação

Todas as rotas (exceto `/health`) exigem:

```
X-Company-Token: <token da empresa>
```

Token inválido → `401 UNAUTHORIZED`  
Empresa desativada (`mobileEnabled = false`) → `403 MOBILE_DISABLED`  
Tenant divergente → `403 CROSS_TENANT`

---

## Rotas

### GET /api/mobile/health
Healthcheck público. Sem autenticação.

**Resposta 200:**
```json
{ "status": "ok", "version": "0.1.0", "timestamp": "ISO 8601" }
```

---

### GET /api/mobile/company/validate
Valida o token da empresa e retorna configuração para o APK.

**Headers:** `X-Company-Token`

**Resposta 200:**
```json
{
  "tenantId": "string",
  "companyCode": "string",
  "apiBaseUrl": "string",
  "mqttHost": "string",
  "mqttPort": 1883,
  "mobileEnabled": true
}
```

---

### GET /api/mobile/bootstrap
Pacote de dados mestres para tela de Seleção Operacional do APK.

**Headers:** `X-Company-Token` · `X-Operator-Id` (opcional)

**Resposta 200:** ver `docs/MOBILE_BOOTSTRAP.md`

---

### POST /api/mobile/shift/start
Inicia uma jornada de trabalho.

**Headers:** `X-Company-Token`

**Body:**
```json
{
  "offlineId": "uuid",
  "operatorId": "string",
  "equipmentId": "string",
  "operationId": "string",
  "costCenterId": "string",
  "timestamp": "ISO 8601"
}
```

**Resposta 200:** `{ "shiftId": "string", "status": "started" }`

---

### POST /api/mobile/shift/end
Encerra a jornada ativa.

**Headers:** `X-Company-Token`

**Body:**
```json
{
  "offlineId": "uuid",
  "shiftId": "string",
  "timestamp": "ISO 8601",
  "finalHorimeter": 1234.5
}
```

---

### POST /api/mobile/events/batch
Envia lote de eventos de jornada (suporta idempotência via `offlineId`).

**Headers:** `X-Company-Token`

**Body:**
```json
{
  "tenantId": "string",
  "events": [
    {
      "offlineId": "uuid",
      "type": "JOURNEY_START | LOCATION | FSM_TRANSITION | STOP_REASON | JOURNEY_END | ...",
      "equipmentId": "string",
      "timestamp": "ISO 8601",
      "payload": { ... }
    }
  ]
}
```

> Atenção: se `body.tenantId !== auth.tenantId` → 403 CROSS_TENANT

---

### POST /api/mobile/heartbeat
Sinal de vida do dispositivo (sem corpo obrigatório).

**Headers:** `X-Company-Token`

**Body (opcional):**
```json
{
  "equipmentId": "string",
  "lat": -23.5,
  "lng": -46.6,
  "timestamp": "ISO 8601"
}
```

---

### POST /api/mobile/location
Atualização de posição GPS.

**Headers:** `X-Company-Token`

**Body:**
```json
{
  "equipmentId": "string",
  "lat": -23.5,
  "lng": -46.6,
  "accuracy": 5.0,
  "timestamp": "ISO 8601"
}
```

---

## Códigos de erro

| Código | Significado |
|--------|-------------|
| 401 | Token ausente ou inválido |
| 403 MOBILE_DISABLED | `mobileEnabled = false` para esta empresa |
| 403 CROSS_TENANT | `body.tenantId` diverge do token |
| 403 EQUIPMENT_NOT_FOUND | Equipamento não pertence ao tenant |
| 409 | Conflito (ex: jornada já iniciada) |
| 429 | Rate limit excedido |
| 500 | Erro interno |

---

## Rate Limiting

Aplicado nas rotas sensíveis (sliding window in-memory):
- `/api/mobile/events/batch`
- `/api/mobile/heartbeat`
- Rotas de token e validação de empresa

`429 Too Many Requests` quando excedido.
