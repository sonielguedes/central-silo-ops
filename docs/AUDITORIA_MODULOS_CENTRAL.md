# AUDITORIA DE MÓDULOS — CENTRAL SILO OPS
**Data:** 06/06/2026 | **Auditor:** Arquiteto Sênior + Auditor SaaS Agro | **Versão:** v0.1.0-piloto

---

## DESCOBERTA CRÍTICA ANTES DOS MÓDULOS

> **`services/base.service.ts` usa `localStorage` do navegador como única camada de persistência.**
>
> Todos os módulos que dependem de `master.service.ts` (EquipmentService, OperatorService, OperationService, etc.)
> **perdem todos os dados ao limpar o cache do navegador, ao trocar de dispositivo, ao acessar em aba anônima
> ou de um segundo computador.** Isso é incompatível com operação real multiusuário SaaS.
>
> Risco classificado como **P0 — Bloqueador de Produção**.

---

## LEGENDA

| Status | Significado |
|--------|-------------|
| ✅ PRONTO | Funcional com dados reais, persistência server-side, sem mock relevante |
| ⚠️ PARCIAL | Renderiza mas falta persistência real, exportação, filtros ou integração APK |
| 🔴 MOCK | Usa dados estáticos, localStorage ou seed para todas as operações |
| ❌ FALTANDO | Tela não existe, funcionalidade crítica ausente |
| 🚨 RISCO | Funciona mas tem risco de produção grave identificado |

---

## 1. Dashboard

**Rota:** `/dashboard` | **Arquivo:** `app/dashboard/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `master.service.ts` → `BaseService` → `localStorage` |
| **Dado real?** | ❌ Não. KPIs, alertas, gráfico de produtividade e tabela de equipamentos usam seed do localStorage |
| **Integração APK** | ❌ Nenhuma. Não consulta `/api/equipamentos/status` |
| **Integração live-state** | ❌ Nenhuma |

**Funcionalidades existentes:**
- KPI cards (equipamentos, operações, alertas, produtividade)
- Tabela de equipamentos
- Alertas recentes
- Gráfico de produtividade
- Painel de sincronização

**Funcionalidades faltantes:**
- Consumir `/api/equipamentos/status` para KPIs reais (online, operando, parado, offline)
- Eventos recentes reais do batch
- Horímetro total real do turno
- Alertas gerados a partir de live-state (GPS stale, HB stale)
- Gráfico de tendência real (histórico de eventos)

**Riscos de produção:** KPIs mostrarão seed data (10 equipamentos fictícios) para todos os operadores.

**Próxima ação técnica:** Migrar KPIs para `/api/equipamentos/status`; migrar alertas para live-state derivado.

---

## 2. Mapa Operacional

**Rota:** `/mapa-operacional` | **Arquivo:** `app/mapa-operacional/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | ✅ PRONTO |
| **Fonte de dados** | `GET /api/equipamentos/status` → `ServerStorage` (server-side JSON) |
| **Dado real?** | ✅ Sim. Posição, status, operador, operação, horímetro do APK |
| **Integração APK** | ✅ Completa via `/api/mobile/events/batch` |
| **Integração live-state** | ✅ Completa |

**Funcionalidades existentes:**
- Marker por equipamento com ícone por tipo e cor por status
- Popup operacional completo (telemetria, operação, horímetro, parada)
- Sidebar com KPIs, lista de frota, clique → flyTo + openPopup
- Rastro histórico (`/api/equipamentos/trail`)
- Alertas de GPS/HB stale no popup
- Polígonos de talhões
- Polling 10s

**Funcionalidades faltantes:**
- Filtro por status/frota na sidebar
- Exportar posição atual como CSV/KML
- Clustering de markers quando zoom baixo
- Histórico de talhões por operação

**Riscos de produção:** Nenhum crítico. Mapa correto com dados reais.

**Próxima ação técnica:** P2 — clustering e exportação KML.

---

## 3. Conectividade Operacional

**Rota:** `/monitoramento/conectividade` | **Arquivo:** `app/monitoramento/conectividade/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | ✅ PRONTO |
| **Fonte de dados** | `GET /api/equipamentos/status` |
| **Dado real?** | ✅ Sim. KPIs, tabela e drawer derivados do live-state |
| **Integração APK** | ✅ Indireta via live-state |
| **Integração live-state** | ✅ Completa |

**Funcionalidades existentes:**
- KPIs: online, offline, último pacote, tempo médio off, sem GPS, falhas
- Status por faixa (OK/ATENÇÃO/CRÍTICO/SEVERO)
- Tabela analítica com filtro/busca
- Drawer de detalhe com campos canônicos
- Empty state para gráfico (sem histórico 24h)
- Polling 30s

**Funcionalidades faltantes:**
- Gráfico de tendência 24h (exige persistência de histórico de snapshots)
- Exportação CSV da tabela
- Notificação push ao detectar CRÍTICO/SEVERO

**Riscos de produção:** Gráfico intencionalmente vazio — comunicar ao gestor.

**Próxima ação técnica:** P1 — endpoint de histórico de snapshots para alimentar gráfico.

---

## 4. Equipamentos (Frota)

**Rota:** `/frota` | **Arquivo:** `app/frota/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `EquipmentService` → `localStorage` |
| **Dado real?** | ⚠️ Cadastro persiste no browser via localStorage. Sincroniza token com server via `/api/mobile/equipment` |
| **Integração APK** | ⚠️ Partial — mobile token sincronizado no server, mas cadastro base no localStorage |
| **Integração live-state** | ❌ Não exibe status/posição atual do equipamento na listagem |

**Funcionalidades existentes:**
- CRUD completo de equipamentos (nome, tipo, modelo, código de frota, mobile token)
- Filtros por status, tipo, grupo
- Sincronização de mobileToken com server-storage via `/api/mobile/equipment`
- Histórico de alterações (audit trail no localStorage)
- Validação de campos obrigatórios

**Funcionalidades faltantes:**
- Coluna de status operacional real (OPERANDO/PARADO/OFFLINE) na lista
- Integração com live-state para exibir posição atual, operador e horímetro
- Persistência server-side do cadastro (não depender de localStorage)
- Importação CSV de equipamentos
- Exportação do cadastro
- Histórico de manutenção por equipamento

**Riscos de produção:** Cadastro criado no desktop não aparece no mobile/tablet do supervisor. 🚨 CRÍTICO.

**Próxima ação técnica:** P0 — migrar EquipmentService para API REST com ServerStorage server-side.

---

## 5. Tipos / Modelos / Grupos / Perfis

**Rotas:** `/frota/tipos`, `/frota/modelos`, `/frota/grupos`, `/frota/perfis`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `master.service.ts` → `localStorage` |
| **Dado real?** | ❌ Dados de seed (INITIAL_EQUIPMENT_TYPES, INITIAL_EQUIPMENT_MODELS, etc.) |
| **Integração APK** | ❌ APK não consome esses cadastros da Central |
| **Integração live-state** | ❌ Nenhuma |

**Funcionalidades existentes:**
- CRUD no localStorage com UI completa
- Filtros e busca
- Paginação

**Funcionalidades faltantes:**
- Persistência server-side
- Vínculo com APK (APK deveria usar tipo para filtrar equipamentos no lookup)
- Exportação

**Riscos de produção:** Dados perdidos ao limpar browser. Não afetam operação do APK diretamente.

**Próxima ação técnica:** P2 — migrar para API server-side após módulos P0 resolvidos.

---

## 6. Checklists

**Rota:** `/frota/checklists` | **Arquivo:** `app/frota/checklists/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `ChecklistService` → `localStorage` + seed com mock questions |
| **Dado real?** | ❌ Checklists cadastrados no browser não chegam ao APK |
| **Integração APK** | ❌ APK não consome endpoint de checklists da Central |
| **Integração live-state** | ❌ Respostas do APK não chegam à Central |

**Funcionalidades existentes:**
- CRUD de templates de checklist (perguntas, tipos de resposta, criticidade)
- Visualização de respostas (mock)
- Filtros

**Funcionalidades faltantes:**
- `GET /api/mobile/checklists` para APK buscar templates
- `POST /api/mobile/checklist-answers` para APK enviar respostas
- Painel de acompanhamento de execuções por jornada
- Assinatura digital (mencionada no roadmap original)
- Exportação de respostas por período

**Riscos de produção:** Checklist é requisito legal em muitas operações agrícolas. Não funciona em produção.

**Próxima ação técnica:** P1 — endpoint mobile + persistência server-side + UI de acompanhamento.

---

## 7. Estados Operacionais

**Rota:** `/frota/estados-operacionais` | **Arquivo:** `app/frota/estados-operacionais/page.tsx`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `master.service.ts` → `localStorage` |
| **Dado real?** | ❌ Cadastro local; APK usa FSM interno sem consultar Central |
| **Integração APK** | ❌ APK não busca estados da Central |
| **Integração live-state** | ⚠️ live-state tem `status` real mas sem vínculo com cadastro |

**Funcionalidades existentes:**
- CRUD de estados operacionais
- Configuração de transições FSM
- Visualização de máquina de estados (520 linhas, mais completo)

**Funcionalidades faltantes:**
- Sincronização de estados com APK via `/api/mobile/operational-states`
- Vínculo entre estado APK e cadastro da Central

**Próxima ação técnica:** P1 — endpoint para APK buscar tabela de estados.

---

## 8. Implementos

**Rota:** `/frota/implementos`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `localStorage` |
| **Integração APK** | ❌ APK não registra implemento acoplado (campo `implementCode` nunca preenchido) |

**Funcionalidades faltantes:** Sincronização bidirecional APK ↔ Central; endpoint de lookup de implemento.

**Próxima ação técnica:** P2 — após resolver cadastro base server-side.

---

## 9. Atividades (Histórico)

**Rota:** `/frota/historico-atividade`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `FleetActivityService` → `localStorage` (seed: `INITIAL_FLEET_ACTIVITIES`) |
| **Integração live-state** | ❌ Não consome eventos batch nem live-state |

**Funcionalidades faltantes:** Derivar atividades dos eventos persistidos em `mobile-events.json`; timeline de jornada real.

**Próxima ação técnica:** P1 — endpoint `GET /api/equipamentos/events?equipmentId=X` para historico real.

---

## 10. Operadores

**Rota:** `/operadores`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `OperatorService` → `localStorage` |
| **Integração APK** | ⚠️ APK envia `operatorName`/`operatorRegistration` nos eventos mas não valida contra cadastro |
| **Integração live-state** | ❌ Não exibe operador ativo por equipamento |

**Funcionalidades existentes:** CRUD completo, filtros, histórico local.

**Funcionalidades faltantes:**
- Persistência server-side
- Vínculo de validação APK (operador não cadastrado = alerta)
- Coluna de "atualmente operando" derivada do live-state
- Produtividade por operador

**Riscos de produção:** Operador criado no desktop desaparece se browser for limpo.

**Próxima ação técnica:** P0 — migrar para API REST server-side.

---

## 11. Fazendas / Talhões

**Rota:** `/fazendas-talhoes`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `FarmService`/`FieldService` → `localStorage` |
| **Integração APK** | ❌ APK não verifica talhão contra cadastro da Central |
| **Integração live-state** | ❌ Não cruza posição GPS do equipamento com geometria do talhão |

**Funcionalidades existentes:** CRUD de fazendas e talhões com coordenadas, filtros.

**Funcionalidades faltantes:**
- Persistência server-side
- Geocerca automática (GPS dentro/fora do talhão)
- Importação de shapefile/GeoJSON
- Exibição de talhões no mapa com equipamentos operando

**Próxima ação técnica:** P1 — server-side + integração com mapa operacional.

---

## 12. Motivos de Parada

**Rota:** `/paradas`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `StopReasonService` → `localStorage` |
| **Integração APK** | ❌ APK envia `stopCode`/`stopDescription` fixos sem buscar tabela da Central |

**Funcionalidades existentes:** CRUD de motivos com código e descrição.

**Funcionalidades faltantes:**
- Persistência server-side
- Endpoint `GET /api/mobile/stop-reasons` para APK buscar tabela vigente
- Painel de paradas ativas derivado do live-state

**Próxima ação técnica:** P1 — endpoint + server-side. APK deveria buscar motivos no login de jornada.

---

## 13. Operações

**Rota:** `/operacoes`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `OperationService` → `localStorage` |
| **Integração APK** | ⚠️ APK envia `operationName`/`operationCode` mas não valida contra cadastro |
| **Integração live-state** | ❌ Lista de operações não mostra quais estão ativas agora |

**Funcionalidades existentes:** CRUD de operações com código, tipo, fazenda vinculada.

**Funcionalidades faltantes:**
- Persistência server-side
- Endpoint lookup para APK
- Painel de operações em curso (cruzado com live-state)
- Vínculo com talhão/safra

**Próxima ação técnica:** P1 — server-side + endpoint mobile.

---

## 14. Timeline

**Rota:** `/operacoes/timeline`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | Nenhuma. Tela renderiza UI de timeline sem dados (234 linhas, sem fetch) |
| **Integração APK** | ❌ Não consome eventos batch |
| **Integração live-state** | ❌ Não consome live-state |

**Funcionalidades existentes:** Layout de timeline (UI shell), filtros de data/equipamento (não funcional).

**Funcionalidades faltantes:**
- Endpoint `GET /api/equipamentos/events?from=X&to=Y` para eventos cronológicos
- Visualização real de JOURNEY_START, LOCATION, FSM_TRANSITION, STOP_REASON, JOURNEY_END
- Filtros funcionais
- Exportação

**Riscos de produção:** Tela está completamente vazia de dados em produção.

**Próxima ação técnica:** P1 — endpoint de eventos + timeline real consumindo `mobile-events.json`.

---

## 15. Abastecimentos

**Rota:** `/abastecimentos`

| Campo | Detalhe |
|-------|---------|
| **Status** | ⚠️ PARCIAL |
| **Fonte de dados** | `SupplyService` → `localStorage` |
| **Integração APK** | ❌ APK não envia evento de abastecimento |

**Funcionalidades existentes:** CRUD de registros de abastecimento com validação de campos.

**Funcionalidades faltantes:**
- Persistência server-side
- Evento `SUPPLY` no APK e processamento no batch
- Relatório de consumo por equipamento/período
- Alerta de tanque baixo

**Próxima ação técnica:** P2 — evento APK + server-side.

---

## 16. Sincronização

**Rota:** `/sincronizacao`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | Nenhuma. 59 linhas. Tela estática. |
| **Integração APK** | ❌ Nenhuma |

**Funcionalidades faltantes:**
- Listar eventos recebidos de `mobile-events.json`
- Status de sincronização por equipamento (último evento recebido)
- Forçar re-sincronização
- Log de erros de batch

**Próxima ação técnica:** P1 — endpoint `GET /api/sync/status` consumindo ServerStorage.

---

## 17. Alertas

**Rota:** `/alertas`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | `ALERTS_DATA` de `lib/mock/dashboard-data` — constante hardcoded |
| **Integração APK** | ❌ Alertas não são gerados pelo live-state |

**Funcionalidades faltantes:**
- Engine de alertas derivado do live-state (GPS stale, HB stale, parada sem motivo, etc.)
- Persistência de alertas gerados
- Notificação push/email
- Reconhecimento de alerta

**Próxima ação técnica:** P0 — motor de alertas server-side consumindo live-state a cada polling.

---

## 18. Relatórios

**Rota:** `/relatorios` e sub-rotas

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | Maioria: telas stub (60-80 linhas cada). `intelligence` e `variaveis-operacionais-online` têm UI mas sem fetch |
| **Integração APK** | ❌ Nenhuma |
| **Integração live-state** | ❌ Nenhuma |

**Sub-rotas:**
- `/relatorios/produtividade` — stub
- `/relatorios/equipamentos` — stub
- `/relatorios/operadores` — stub
- `/relatorios/paradas` — stub
- `/relatorios/abastecimentos` — stub
- `/relatorios/sincronizacao` — stub
- `/relatorios/auditoria` — stub
- `/relatorios/intelligence` — UI rich mas sem dados (361 linhas, zero fetch)
- `/relatorios/variaveis-operacionais-online` — UI rich mas sem dados (429 linhas, zero fetch)
- `/relatorios/operacional` — stub

**Funcionalidades faltantes (todas):**
- Endpoints de agregação por período
- Gráficos com dados reais
- Exportação PDF/CSV
- Filtros funcionais

**Próxima ação técnica:** P2 — após persistência server-side de todos os eventos. Priorizar produtividade + paradas.

---

## 19. Auditoria (Relatório)

**Rota:** `/relatorios/auditoria`

| Campo | Detalhe |
|-------|---------|
| **Status** | ❌ FALTANDO |
| **Fonte de dados** | Stub de 60 linhas. Nenhum dado. |
| **Integração live-state** | ❌ |

**Funcionalidades faltantes:**
- Log de ações por usuário (quem alterou o quê)
- Audit trail de eventos APK
- Histórico de logins/sessões

**Próxima ação técnica:** P2 — integrar com history[] do BaseService e eventos do ServerStorage.

---

## 20. Configurações

**Rota:** `/configuracoes`

| Campo | Detalhe |
|-------|---------|
| **Status** | 🔴 MOCK |
| **Fonte de dados** | UI estática (108 linhas), sem persistência |

**Funcionalidades faltantes:**
- Configurações de tenant (nome, logo, tema)
- Parâmetros de alertas (thresholds de GPS/HB)
- Configuração de polígonos de talhões

**Próxima ação técnica:** P2.

---

## 21. Administração: Empresas / Usuários / RBAC

**Rotas:** `/administracao/empresas`, `/administracao/usuarios`, `/administracao/grupos-acesso`

| Campo | Detalhe |
|-------|---------|
| **Status Empresas** | ✅ PRONTO (mais completo do sistema) |
| **Status Usuários** | ⚠️ PARCIAL |
| **Status RBAC** | ⚠️ PARCIAL |

**Empresas:**
- CompanyToken real persistido no server via `/api/admin/companies/token`
- Portas API/MQTT com unicidade validada
- Sync com `/api/mobile/company`
- ✅ Produção-ready para gestão de tenants

**Usuários:**
- CRUD via localStorage
- Validação de consistência de campos
- Sem persistência server-side
- ❌ Usuário criado em um browser não existe em outro

**RBAC:**
- Estrutura de grupos de acesso no localStorage
- `withAuth` HOC funcional mas verificação mock
- ❌ Sem JWT real, sem sessão server-side, sem refresh token

**Próxima ação técnica (Usuários):** P0 — server-side.
**Próxima ação técnica (RBAC):** P0 — autenticação real (NextAuth + DB).

---

## 22. Ficha Operador / Exportação

**Rota:** `/ferramentas/ficha-operador`

| Campo | Detalhe |
|-------|---------|
| **Status** | ✅ PRONTO |
| **Fonte de dados** | `GET /api/equipamentos/status` |
| **Dado real?** | ✅ Sim. Campos canônicos do live-state |
| **Integração APK** | ✅ Indireta via live-state |

**Funcionalidades existentes:**
- Listagem por jornada com status ATUALIZADO/INCONSISTENTE/PENDENTE/EXPORTADO
- Detecção automática de inconsistências
- Edição em lote (fazenda, zona, talhão, CC override)
- Exportação CSV com sumário (total/incluído/alterado/erro)
- Overrides preservados entre atualizações

**Funcionalidades faltantes:**
- Persistência de overrides no server (fazenda/zona/talhão editados se perdem no reload)
- Integração com módulo de Fazendas/Talhões para dropdown real
- Exportação no formato do ERP/BI do cliente
- Assinatura digital do responsável pela exportação

**Próxima ação técnica:** P1 — persistir overrides server-side; dropdown de fazendas real.

---

## PAINEL DE CONTROLE — STATUS CONSOLIDADO

| # | Módulo | Status | Dado Real | APK | P |
|---|--------|--------|-----------|-----|---|
| 1 | Dashboard | 🔴 MOCK | ❌ localStorage | ❌ | P0 |
| 2 | Mapa Operacional | ✅ PRONTO | ✅ server-side | ✅ | — |
| 3 | Conectividade | ✅ PRONTO | ✅ server-side | ✅ indireta | P2 |
| 4 | Equipamentos (Frota) | ⚠️ PARCIAL | ⚠️ localStorage | ⚠️ token OK | P0 |
| 5 | Tipos/Modelos/Grupos/Perfis | 🔴 MOCK | ❌ localStorage | ❌ | P2 |
| 6 | Checklists | ⚠️ PARCIAL | ❌ localStorage | ❌ | P1 |
| 7 | Estados Operacionais | ⚠️ PARCIAL | ❌ localStorage | ❌ | P1 |
| 8 | Implementos | 🔴 MOCK | ❌ localStorage | ❌ | P2 |
| 9 | Atividades (Histórico) | 🔴 MOCK | ❌ localStorage | ❌ | P1 |
| 10 | Operadores | ⚠️ PARCIAL | ❌ localStorage | ⚠️ envia | P0 |
| 11 | Fazendas / Talhões | ⚠️ PARCIAL | ❌ localStorage | ❌ | P1 |
| 12 | Motivos de Parada | 🔴 MOCK | ❌ localStorage | ❌ | P1 |
| 13 | Operações | ⚠️ PARCIAL | ❌ localStorage | ⚠️ envia | P1 |
| 14 | Timeline | 🔴 MOCK | ❌ nenhuma | ❌ | P1 |
| 15 | Abastecimentos | ⚠️ PARCIAL | ❌ localStorage | ❌ | P2 |
| 16 | Sincronização | 🔴 MOCK | ❌ nenhuma | ❌ | P1 |
| 17 | Alertas | 🔴 MOCK | ❌ hardcoded | ❌ | P0 |
| 18 | Relatórios (todos) | 🔴 MOCK | ❌ nenhuma | ❌ | P2 |
| 19 | Auditoria | ❌ FALTANDO | ❌ | ❌ | P2 |
| 20 | Configurações | 🔴 MOCK | ❌ nenhuma | ❌ | P2 |
| 21a | Adm. Empresas | ✅ PRONTO | ✅ server-side | ✅ | — |
| 21b | Adm. Usuários | ⚠️ PARCIAL | ❌ localStorage | ❌ | P0 |
| 21c | RBAC / Auth | 🚨 RISCO | ❌ mock auth | ❌ | P0 |
| 22 | Ficha Operador | ✅ PRONTO | ✅ server-side | ✅ indireta | P1* |

> *P1 para persistência de overrides.

---

## RESUMO EXECUTIVO

| Categoria | Qtd |
|-----------|-----|
| ✅ PRONTO (produção-ready) | 3 |
| ⚠️ PARCIAL (funciona mas com restrições graves) | 8 |
| 🔴 MOCK (localStorage / hardcoded / stub) | 10 |
| ❌ FALTANDO | 1 |
| 🚨 RISCO CRÍTICO | 1 |

**Bloqueadores para Deploy Comercial:**
1. `BaseService` usa `localStorage` → 15+ módulos perdem dados entre browsers
2. Autenticação mock (`withAuth`) → qualquer URL é acessível sem login real
3. Dashboard com dados de seed → KPIs incorretos para gestores
4. Motor de alertas inexistente → gestor não é notificado de problemas críticos

---
*Gerado em 06/06/2026 por auditoria técnica automatizada.*
