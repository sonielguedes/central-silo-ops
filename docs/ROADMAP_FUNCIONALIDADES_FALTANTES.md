# ROADMAP DE FUNCIONALIDADES FALTANTES — CENTRAL SILO OPS
**Data:** 06/06/2026 | **Versão:** v0.1.0-piloto → v1.0.0-comercial

---

## PREMISSA ARQUITETURAL

O maior bloqueador de produção não é uma funcionalidade isolada — é a **camada de persistência**.
`BaseService` usa `localStorage`, que é:
- Restrito ao navegador onde foi criado
- Perdido ao limpar cache ou usar aba anônima
- Inacessível em outros dispositivos/computadores
- Incompatível com acesso multiusuário simultâneo

**Toda entidade de cadastro (operadores, equipamentos, operações, fazendas, motivos de parada, checklists)
deve migrar para uma API REST com `ServerStorage` (arquivos JSON server-side) ou banco de dados.**

---

## MATRIZ DE PRIORIDADE

### P0 — BLOQUEADORES DE PRODUÇÃO (antes de qualquer cliente real)

| ID | Funcionalidade | Módulo | Esforço | Dependência |
|----|----------------|--------|---------|-------------|
| P0-01 | Autenticação real (NextAuth + sessão server-side) | Auth/RBAC | Grande | Nenhuma — deve ser PRIMEIRO |
| P0-02 | Migrar `EquipmentService` para API REST server-side | Equipamentos | Médio | P0-01 |
| P0-03 | Migrar `OperatorService` para API REST server-side | Operadores | Médio | P0-01 |
| P0-04 | Dashboard com KPIs reais de `/api/equipamentos/status` | Dashboard | Pequeno | Nenhuma |
| P0-05 | Motor de alertas server-side (GPS/HB stale, parada sem motivo) | Alertas | Médio | Nenhuma |
| P0-06 | Migrar `UserService` para API REST server-side | Usuários | Médio | P0-01 |

---

### P1 — FUNCIONALIDADES ESSENCIAIS PARA OPERAÇÃO REAL (Sprint 1-2)

| ID | Funcionalidade | Módulo | Esforço | Dependência |
|----|----------------|--------|---------|-------------|
| P1-01 | Timeline real de eventos por equipamento/jornada | Timeline | Grande | Nenhuma (usa mobile-events.json existente) |
| P1-02 | Endpoint `GET /api/mobile/stop-reasons` + server-side | Motivos de Parada | Pequeno | P0-02 |
| P1-03 | Endpoint `GET /api/mobile/checklists` + respostas APK | Checklists | Grande | P0-02 |
| P1-04 | Endpoint `GET /api/mobile/operations` para lookup APK | Operações | Pequeno | Server-side operações |
| P1-05 | Migrar `OperationService` para server-side | Operações | Médio | P0-01 |
| P1-06 | Migrar `FarmService`/`FieldService` para server-side | Fazendas/Talhões | Médio | P0-01 |
| P1-07 | Painel Sincronização real (`GET /api/sync/status`) | Sincronização | Pequeno | Nenhuma |
| P1-08 | Histórico de atividades real (consumir mobile-events.json) | Atividades | Médio | Nenhuma |
| P1-09 | Persistência server-side de overrides da Ficha Operador | Ficha Operador | Pequeno | Nenhuma |
| P1-10 | Estados Operacionais: endpoint para APK buscar tabela | Estados Oper. | Pequeno | Nenhuma |
| P1-11 | Histórico de snapshots de conectividade (24h) | Conectividade | Médio | Nenhuma |
| P1-12 | Geocerca automática GPS ↔ talhão | Fazendas/Talhões | Grande | P1-06 |

---

### P2 — MELHORIAS E MÓDULOS SECUNDÁRIOS (Sprint 3-4)

| ID | Funcionalidade | Módulo | Esforço | Dependência |
|----|----------------|--------|---------|-------------|
| P2-01 | Relatório de Produtividade (horas operadas, paradas, horímetro) | Relatórios | Grande | P1-01, P1-08 |
| P2-02 | Relatório de Paradas (por motivo, por equipamento, por período) | Relatórios | Médio | P1-02 |
| P2-03 | Relatório de Operadores (produtividade individual) | Relatórios | Médio | P1-05 |
| P2-04 | Relatório de Abastecimentos (consumo, custo) | Relatórios | Médio | Abastecimento server-side |
| P2-05 | Migrar Tipos/Modelos/Grupos/Perfis para server-side | Frota (mestres) | Médio | P0-01 |
| P2-06 | Migrar Implementos para server-side + evento APK | Implementos | Médio | P0-02 |
| P2-07 | Evento `SUPPLY` no APK + endpoint abastecimento | Abastecimentos | Médio | APK-side |
| P2-08 | Importação CSV de equipamentos/operadores | Equipamentos/Operadores | Médio | P0-02, P0-03 |
| P2-09 | Exportação KML/GeoJSON de posições | Mapa Operacional | Pequeno | Nenhuma |
| P2-10 | Clustering de markers no mapa (zoom baixo) | Mapa Operacional | Pequeno | Nenhuma |
| P2-11 | Notificação push/email de alertas críticos | Alertas | Grande | P0-05 |
| P2-12 | Audit trail de ações de usuário (log server-side) | Auditoria | Médio | P0-01 |
| P2-13 | Configurações de tenant (logo, thresholds, tema) | Configurações | Médio | P0-01 |
| P2-14 | Assinatura digital na Ficha Operador | Ficha Operador | Grande | P1-09 |
| P2-15 | Exportação no formato ERP do cliente | Ficha Operador | Médio | P1-09 |
| P2-16 | BI externo embarcado (iFrame) | Relatórios Intelligence | Grande | Contrato BI |
| P2-17 | Webhook para Climate FieldView | Integrações | Grande | P0-01 |

---

## PLANO DE IMPLEMENTAÇÃO SUGERIDO

### Sprint 0 (Semana 1-2) — Infraestrutura

```
P0-01 → NextAuth com credenciais no ServerStorage
         → JWT session, middleware de proteção, tenant por sessão
         → Remover mock withAuth

P0-04 → Dashboard KPIs reais (1 dia)
P0-05 → Motor de alertas (live-state polling a cada 60s no server)
```

### Sprint 1 (Semana 3-4) — Cadastros Server-Side

```
P0-02 → API REST /api/cadastro/equipamentos (CRUD)
P0-03 → API REST /api/cadastro/operadores (CRUD)
P0-06 → API REST /api/cadastro/usuarios (CRUD)
P1-05 → API REST /api/cadastro/operacoes (CRUD)
P1-06 → API REST /api/cadastro/fazendas e /talhoes (CRUD + coords)
```

### Sprint 2 (Semana 5-6) — Integração APK

```
P1-02 → GET /api/mobile/stop-reasons
P1-04 → GET /api/mobile/operations
P1-10 → GET /api/mobile/operational-states
P1-01 → Timeline real consumindo mobile-events.json
P1-08 → Histórico de atividades real
P1-07 → Painel de sincronização real
```

### Sprint 3 (Semana 7-8) — Checklists e Relatórios Base

```
P1-03 → Checklists: templates + respostas APK
P2-01 → Relatório de Produtividade
P2-02 → Relatório de Paradas
P1-11 → Histórico de snapshots de conectividade
P1-12 → Geocerca GPS ↔ talhão
```

### Sprint 4 (Semana 9-10) — Qualidade e Secundários

```
P2-05 → Tipos/Modelos/Grupos/Perfis server-side
P2-03 → Relatório Operadores
P2-08 → Importação CSV
P2-12 → Audit trail
P2-13 → Configurações de tenant
```

---

## ESTIMATIVA DE ESFORÇO

| Categoria | Qtd items | Esforço estimado |
|-----------|-----------|------------------|
| P0 Bloqueadores | 6 | ~3 semanas |
| P1 Essenciais | 12 | ~4 semanas |
| P2 Melhorias | 17 | ~6 semanas |
| **Total** | **35** | **~13 semanas** |

---

## MÓDULOS JÁ PRONTOS (não requerem ação)

| Módulo | Observação |
|--------|-----------|
| Mapa Operacional | ✅ 100% real. Manter e evoluir com geocerca (P1-12) |
| Conectividade | ✅ Real. Adicionar histórico 24h (P1-11) |
| Painel Operacional | ✅ Real. Funcional |
| Administração Empresas | ✅ Real. Server-side completo |
| Ficha Operador | ✅ Real. Pendente override server-side (P1-09) |
| API Mobile (batch, lookup, heartbeat, location, health) | ✅ Produção-ready |
| Trail (rastro) | ✅ Real. Funcional |

---

## RISCOS NÃO TÉCNICOS

1. **Multiusuário simultâneo:** Quando dois gestores editam o mesmo equipamento no localStorage de browsers diferentes, os dados são inconsistentes sem conflito visível.

2. **Conformidade legal (Checklists):** Inspeções e checklists sem persistência server-side não têm validade legal. Risco de não-conformidade em auditorias.

3. **Perda de dados em campo:** Operadores podem abrir a Central em dispositivos diferentes do supervisor — dados de produtividade e paradas invisíveis para um dos lados.

4. **Segurança:** `withAuth` HOC não valida token JWT real. Qualquer pessoa com a URL acessa qualquer módulo se souber o caminho direto.

---

## QUICK WINS (< 1 dia cada)

Implementações de alto impacto e baixo esforço:

| # | Ação | Impacto |
|---|------|---------|
| QW-01 | Dashboard: substituir KPIs por `/api/equipamentos/status` | Alto — gestor vê números reais imediatamente |
| QW-02 | `/api/sync/status` mostrando últimos eventos por equipamento | Médio — gestor sabe quem está comunicando |
| QW-03 | Motor de alertas: varrer live-state a cada 60s e gravar em `alerts.json` | Alto — `/alertas` passa a ter dados reais |
| QW-04 | Timeline: endpoint que lê `mobile-events.json` e retorna por equipamento | Alto — timeline passa a mostrar jornada real |
| QW-05 | Sincronização: tela que lista arquivos em `data/{tenantId}/` com contagem | Médio — visibilidade de dados recebidos |

---
*Gerado em 06/06/2026. Revisão recomendada a cada sprint.*
