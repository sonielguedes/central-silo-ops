# Mobile Bootstrap — SILO OPS

**Rota:** `GET /api/mobile/bootstrap`  
**Autenticação:** `X-Company-Token` (obrigatório)  
**Escopo:** Tenant extraído exclusivamente do token — zero cross-tenant  
**Data:** 2026-06-16  

---

## Propósito

Retorna o pacote de dados mestres necessário para a tela **Seleção Operacional** do APK SILO OPS Field. O APK chama este endpoint após validar o QR Code da empresa, antes de qualquer jornada.

---

## Headers obrigatórios

| Header | Descrição |
|--------|-----------|
| `X-Company-Token` | Token único da empresa (obrigatório) |
| `X-Operator-Id` | Matrícula ou ID do operador (opcional — retorna dados do operador) |

---

## Payload de resposta

```json
{
  "tenantId": "string",
  "operator": null,
  "equipments": [...],
  "workOrders": [...],
  "costCenters": [...],
  "implements": [...],
  "operations": [...],
  "stopReasons": [...],
  "updatedAt": "ISO 8601",
  "version": "sha1-12chars"
}
```

---

## Filtros aplicados por entidade

| Entidade | Filtro |
|----------|--------|
| `equipments` | `mobileEnabled !== false` AND `entityStatus === 'ATIVO'` |
| `workOrders` | `status === 'ABERTA'` AND `entityStatus === 'ATIVO'` |
| `costCenters` | `status === 'ATIVO'` AND `entityStatus === 'ATIVO'` |
| `implements` | `entityStatus === 'ATIVO'` AND `status NOT IN (INATIVO, MANUTENCAO)` |
| `operations` | `entityStatus === 'ATIVO'` AND `status NOT IN (FINALIZADA, CANCELADA)` |
| `stopReasons` | `isActive !== false` |

---

## Estado atual (2026-06-16)

| Campo | Estado | Observação |
|-------|--------|------------|
| `equipments` | ✅ Funcional | Lê de `CadastroStorage('equipamentos')` |
| `costCenters` | ✅ Funcional | Lê de `CadastroStorage('centros-custo')` — **módulo criado em 2026-06-16** |
| `stopReasons` | ✅ Funcional | Lê de `CadastroStorage('paradas')` · seeded para novos tenants |
| `implements` | ✅ Funcional | 12 tipos + 26 modelos agrícolas no seed |
| `workOrders` | ✅ Funcional | Lê de `CadastroStorage('ordens-servico')` |
| `operations` | ❌ BLOQUEADOR | `operations = 0` para tenant novo — APK não avança sem operações |
| `operator` | ✅ Funcional | Retornado se `X-Operator-Id` enviado; campos sensíveis redactados |

---

## Critério mínimo APK para liberar tela de seleção

```
equipments.length >= 1   ← pelo menos 1 equipamento ativo
costCenters.length >= 1  ← pelo menos 1 centro de custo ✅
stopReasons.length >= 1  ← seeded automaticamente ✅
operations.length >= 1   ← BLOQUEADOR — cadastrar em /operacoes
```

---

## Seed de dados para novos tenants

O `SEED_MAP` em `lib/mock/master-data.ts` aplica dados iniciais quando o arquivo JSON do tenant não existe. Entidades com seed:

- `paradas` — motivos de parada padrão
- `tipos` — 12 tipos de implementos agrícolas adicionados em 2026-06-16
- `modelos` — 26 modelos de implementos vinculados por `typeId`
- `equipamentos`, `operadores`, `operacoes`, `fazendas` — seed demo (ativado apenas quando `shouldSeedDemoData() === true`)

> **Centros de custo** (`centros-custo`) não têm seed automático — o tenant precisa cadastrar pelo menos 1 via `/centros-custo` na Central Web.

---

## Segurança

- `tenantId` derivado exclusivamente do `companyToken` — nunca de header enviado pelo APK
- Token inválido → 401
- Empresa desativada (`mobileEnabled = false`) → 403
- Dados de operador: campos `passwordHash`, `password`, `pin`, `pinHash` são redactados antes de retornar
- `version` (SHA-1 dos primeiros 12 chars) permite APK detectar mudanças sem recarregar tudo
