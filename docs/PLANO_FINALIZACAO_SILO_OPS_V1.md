> **Atualizado em 2026-06-16:** C5.1 (Segurança), C5.2 (Multi-tenant) e C5.3 (RBAC/Usuários) **CONCLUÍDOS**.
> C5.4 (Estabilidade 24/7), C5.5 (APK Produção) e C5.6 (Comercial) **PENDENTES**.
> Bloqueador atual: `operations = 0` no bootstrap — APK precisa de ≥1 operação.

---

# PLANO DE FINALIZAÇÃO — SILO OPS v1.0 PRODUÇÃO

**Produto:** SILO OPS — Sistema de Inteligência Logística Operacional  
**Componentes:** SILO OPS Central (Web) + SILO OPS Field (APK Android)  
**Data de criação:** 2026-06-08  
**Responsável técnico:** Soniel  
**Versão do documento:** 1.0  

---

## 1. Status Atual

### O que já está concluído

- **Central online em VPS com Docker** — deploy funcional via docker-compose + nginx reverse proxy.
- **API mobile funcional** — rotas POST /api/mobile/events/batch, heartbeat, location, shift/start, shift/end, equipment, company sincronizando com APK Field.
- **Jornada real operando** — ciclo completo: início de jornada → eventos operacionais → paradas → fim de jornada com persistência em mobile-events.json e live-state.json.
- **Rastro GPS** — trail points coletados e exibidos no mapa operacional com atualização em tempo real.
- **Ficha do operador** — cadastro completo de operadores com vínculo a equipamentos e jornadas.
- **Dashboard operacional** — KPIs em tempo real, mapa com frota, tabela de equipamentos, gráficos de produtividade.
- **C4.3 — Relatório de Eficiência Operacional** — relatório completo com summary, byFleet, top paradas, timeline e exportação CSV.
- **C4.4 — Validação de Regras de Negócio** — regras de paradas, sobreposição, limites de duração e consistência validadas.
- **C4.5 — Relatório de Tempo Operacional** — relatório detalhado com core compartilhado, API dedicada e exportação.
- **Alertas reais** — geração automática de alertas a partir de live-state e mobile-events (heartbeat, GPS, horímetro, paradas, jornadas). Sem mocks. Com dedup, acknowledge, resolve e audit-log.
- **Cadastro CRUD** — entidades (equipamentos, operadores, implementos, operações, grupos, fazendas, talhões) com persistência por tenant.
- **Módulo de operações** — /operacoes e /operacoes/timeline com guards defensivos, error/loading/empty states.

### O que ainda impede de chamar o sistema de v1.0 produção

- **Segurança incompleta** — C5.1 em andamento: guards de API criados, rate limit criado, audit-log criado, mas falta validação final de build e commit.
- **Sem multiempresa real** — tenant único hardcoded. Não há isolamento de dados entre empresas.
- **Sem controle de usuários e permissões** — qualquer usuário com acesso à URL vê tudo. Sem papéis (ADMIN, GESTOR, COA, etc.).
- **Sem estabilidade 24/7** — sem logs estruturados, sem healthcheck externo, sem backup automático, sem restart seguro.
- **APK não é release assinado** — build de debug. Sem assinatura para Google Play ou distribuição interna.
- **Sem documentação comercial** — sem manual do operador, sem checklist de implantação, sem proposta comercial.

---

## 2. Meta da v1.0

O SILO OPS deixa de ser **piloto** e passa a ser **v1.0 produção** quando atender simultaneamente:

1. Segurança mínima implementada (C5.1 completo).
2. Isolamento multiempresa funcional (C5.2 completo).
3. APK assinado com jornada completa validada em aparelho real (C5.5 completo).

Estes três itens formam o **marco de saída do piloto**. Os demais (C5.3, C5.4, C5.6) elevam o produto de v1.0 para v1.1 Enterprise.

---

## 3. Etapas Restantes

### C5.1 — Hardening Produção / Segurança Mínima

**Objetivo:** Proteger a Central e APIs antes de expandir para cliente real.

**Escopo:**

- Guard central de API (`lib/auth/api-guard.ts`): `requireWebAdmin`, `requireMobileAuth`, `requireTenant`, `blockWriteInDemo`.
- Proteção de 8 rotas mobile: exigir tenantId, exigir X-Company-Token, validar mobileToken, rejeitar token inválido (403), rejeitar ausência (401), nunca logar token completo.
- Proteção de rotas web de escrita: cadastro POST/PUT/DELETE, alertas acknowledge/resolve/resolve-all.
- Demo safety: `NEXT_PUBLIC_APP_ENV=demo` bloqueia POST/PUT/DELETE com 403.
- Audit log global (`lib/audit/audit-log.ts`): persistência em `data/{tenantId}/audit-log.jsonl` com timestamp, userId, action, entity, entityId, before/after, ip, userAgent.
- Healthcheck completo: `GET /api/health/full` retornando status do app, data dir, mobile-events, live-state, alerts, disk, version, timestamp.
- Rate limit (`lib/security/rate-limit.ts`): sliding window in-memory aplicado em mobile/events/batch, heartbeat, admin/companies/token.
- Backup: `scripts/backup-data.sh` para data/ e .env.production em `backups/siloops-data-YYYYMMDD-HHMMSS.tar.gz`.

**Critérios de aceite:**

- `npx tsc --noEmit` sem erros novos.
- Token inválido retorna 403 em todas as rotas mobile.
- Ausência de token retorna 401.
- Demo mode bloqueia escrita com 403.
- Audit log persiste ações de escrita.
- Healthcheck retorna 200 quando saudável, 503 quando degradado.
- Rate limit retorna 429 quando excedido.
- Backup script gera arquivo .tar.gz válido.

**Commit:** `feat: add production security hardening`

**Status:** EM ANDAMENTO — guards, rate limit, audit-log, healthcheck e backup já implementados. Validação TypeScript limpa.

---

### C5.2 — Multiempresa / Tenant Produção

**Objetivo:** Garantir isolamento completo de dados entre empresas clientes.

**Escopo:**

- Isolamento por tenant: cada empresa opera exclusivamente em `data/{tenantId}/`.
- Token por empresa: cada Company tem `companyToken` único; API valida token contra tenant.
- Usuário só vê sua empresa: filtro obrigatório por tenantId em todas as queries de leitura.
- API rejeita tenant divergente: se o token pertence ao tenant A, requisição com dados do tenant B retorna 403.
- Backup por cliente: backup script separado por tenant com retenção independente.

**Critérios de aceite:**

- Dois tenants simultâneos sem vazamento de dados cruzado.
- Token do tenant A não acessa dados do tenant B.
- Backup gera arquivo separado por tenant.
- Dashboard, cadastro e relatórios filtram por tenant automaticamente.

**Commit:** `feat: add multi-tenant production isolation`

---

### C5.3 — Usuários, Papéis e Permissões

**Objetivo:** Controlar acesso por papel e módulo.

**Escopo:**

- **SUPER_ADMIN** — acesso total, todas as empresas, configuração global.
- **ADMIN_EMPRESA** — gestão completa da própria empresa: cadastros, configurações, usuários.
- **GESTOR** — dashboard, relatórios, alertas, operações da própria empresa. Sem acesso a configurações de sistema.
- **COA** — Centro de Operações Agrícolas: visualização em tempo real, mapa, alertas. Sem escrita em cadastros.
- **CONSULTA** — somente leitura em dashboard e relatórios.
- **AUDITOR** — acesso ao audit-log e relatórios de auditoria. Sem escrita.
- Permissões por módulo: cada rota/menu exige papel mínimo.
- Bloqueio de rota e menu: sidebar renderiza apenas itens permitidos; rotas retornam 403 para papel insuficiente.

**Critérios de aceite:**

- Login com credenciais retorna JWT com papel e tenantId.
- Rota protegida rejeita papel insuficiente com 403.
- Sidebar exibe apenas módulos permitidos para o papel.
- SUPER_ADMIN vê todas as empresas; outros papéis veem apenas a própria.

**Commit:** `feat: add role-based access control`

---

### C5.4 — Estabilidade Operacional 24/7

**Objetivo:** Garantir operação contínua sem intervenção manual.

**Escopo:**

- Logs estruturados: formato JSON com timestamp, level, module, message, metadata. Rotação diária.
- Healthcheck externo: endpoint monitorado por UptimeRobot ou similar com alerta por e-mail/Telegram.
- Backup automático: cron job executando `scripts/backup-data.sh` diariamente às 02:00.
- Restart seguro: Docker restart policy `unless-stopped` + graceful shutdown com SIGTERM.
- Verificação de disco: healthcheck inclui espaço livre; alerta quando < 1GB.
- Retenção de histórico: mobile-events e audit-log com rotação por data (manter 90 dias).
- Limpeza segura: script de arquivamento que move dados antigos para `archive/` sem deletar.

**Critérios de aceite:**

- Sistema reinicia automaticamente após crash do container.
- Backup diário verificável com restore testado.
- Logs rotativos sem crescimento ilimitado.
- Alerta de disco cheio antes de falha.
- Histórico de 90 dias acessível; dados anteriores arquivados.

**Commit:** `feat: add 24/7 operational stability`

---

### C5.5 — APK Produção

**Objetivo:** Entregar APK assinado pronto para distribuição e operação real.

**Escopo:**

- Release assinado: keystore de produção, build `assembleRelease` com ProGuard/R8.
- Token seguro: armazenamento de companyToken e mobileToken em EncryptedSharedPreferences.
- Sync offline-first: fila local de eventos com Room Database + tabela Outbox.
- Room/Outbox: entidade `PendingEvent` com status (PENDING, SYNCING, SYNCED, FAILED), timestamp, retries.
- WorkManager: sincronização periódica a cada 5min + on-demand quando conectividade restaurada.
- Teste offline/online: ciclo completo — operar offline 30min → reconectar → verificar sync total.
- Teste em aparelho real: Samsung/Motorola com Android 10+ em campo.
- Jornada completa validada: início → operação → parada → retomada → fim com todos os eventos persistidos na Central.

**Critérios de aceite:**

- APK assinado instalável via link direto (sem Google Play inicialmente).
- Operação offline de 30min sem perda de dados.
- Sync automático ao reconectar com dedup (offlineId).
- Jornada completa de 8h validada em aparelho real sem crash.
- Horímetro, GPS e eventos consistentes após sync.

**Commit:** `feat: release production APK v1.0`

---

### C5.6 — Comercial / Implantação Cliente

**Objetivo:** Preparar material para onboarding do primeiro cliente pagante.

**Escopo:**

- Manual do operador: guia ilustrado para uso do APK Field (início de jornada, paradas, fim de jornada, troubleshooting).
- Manual do gestor: guia da Central Web (dashboard, relatórios, alertas, cadastros, configurações).
- Manual de instalação do APK: passo a passo para instalar via link, configurar token, primeiro sync.
- Checklist go-live: lista verificável de pré-requisitos antes de ativar cliente (VPS, DNS, token, backup, equipamentos cadastrados, operadores cadastrados, teste de jornada).
- Proposta comercial: template com descrição do produto, módulos, preço por equipamento/mês, SLA.
- SLA básico: disponibilidade 99%, tempo de resposta para incidentes, canais de suporte.
- Rotina de suporte: fluxo de atendimento (Telegram/WhatsApp → triagem → resolução), escalonamento, horário.

**Critérios de aceite:**

- Manuais revisados e em PDF.
- Checklist go-live testado com pelo menos 1 implantação piloto.
- Proposta comercial aprovada internamente.
- Canal de suporte configurado e testado.

**Commit:** `docs: add commercial and deployment documentation`

---

## 4. Ordem Recomendada

| Ordem | Etapa | Justificativa |
|-------|-------|---------------|
| 1 | C5.1 — Segurança | Pré-requisito para qualquer acesso externo |
| 2 | C5.2 — Multiempresa | Isolamento obrigatório antes de adicionar segundo cliente |
| 3 | C5.3 — Permissões | Controle de acesso por papel dentro de cada empresa |
| 4 | C5.4 — Estabilidade 24/7 | Operação contínua sem intervenção |
| 5 | C5.5 — APK Produção | Release assinado com sync robusto |
| 6 | C5.6 — Comercial | Material de implantação e suporte |

**Nota:** C5.5 (APK) pode ser desenvolvido em paralelo com C5.2/C5.3 pois opera no repositório Android separado.

---

## 5. Marco de Saída do Piloto

O SILO OPS **deixa de ser piloto** quando concluir:

- **C5.1** — Segurança mínima (guards, rate limit, audit-log, healthcheck, backup)
- **C5.2** — Multiempresa funcional (isolamento por tenant, token por empresa)
- **C5.5** — APK assinado com jornada completa validada em aparelho real

Ao concluir estes três itens, o sistema é promovido de **v0.9 Pré-Produção** para **v1.0 Produção**.

---

## 6. Checklist v1.0

| Item | Status |
|------|--------|
| Guard central de API (api-guard.ts) | CONCLUÍDO |
| Proteção rotas mobile (8 rotas) | CONCLUÍDO |
| Proteção rotas web de escrita | CONCLUÍDO |
| Demo safety (blockWriteInDemo) | CONCLUÍDO |
| Audit log global (audit-log.ts) | CONCLUÍDO |
| Healthcheck completo (/api/health/full) | CONCLUÍDO |
| Rate limit (rate-limit.ts) | CONCLUÍDO |
| Backup script (backup-data.sh) | CONCLUÍDO |
| Validação TypeScript C5.1 | CONCLUÍDO |
| Commit C5.1 | CONCLUÍDO |
| Isolamento por tenant | CONCLUÍDO |
| Token por empresa validado | CONCLUÍDO |
| Usuário só vê sua empresa | CONCLUÍDO |
| API rejeita tenant divergente | CONCLUÍDO |
| Backup por cliente | CONCLUÍDO |
| SUPER_ADMIN / ADMIN_EMPRESA / GESTOR / COA / CONSULTA / AUDITOR | CONCLUÍDO |
| Permissões por módulo | CONCLUÍDO |
| Bloqueio de rota e menu | CONCLUÍDO |
| Logs estruturados | PENDENTE |
| Healthcheck externo | PENDENTE |
| Backup automático (cron) | PENDENTE |
| Restart seguro | PENDENTE |
| Verificação de disco | PENDENTE |
| Retenção de histórico 90d | PENDENTE |
| APK release assinado | PENDENTE |
| Token seguro (EncryptedSharedPreferences) | PENDENTE |
| Sync offline-first (Room/Outbox) | PENDENTE |
| WorkManager sync periódico | PENDENTE |
| Teste offline/online 30min | PENDENTE |
| Teste aparelho real | PENDENTE |
| Jornada completa 8h validada | PENDENTE |
| Manual operador | PENDENTE |
| Manual gestor | PENDENTE |
| Manual instalação APK | PENDENTE |
| Checklist go-live | PENDENTE |
| Proposta comercial | PENDENTE |
| SLA básico | PENDENTE |
| Rotina de suporte | PENDENTE |

---

## 7. Nome das Versões

| Versão | Nome | Descrição |
|--------|------|-----------|
| v0.9 | SILO OPS Pré-Produção | Estado atual — piloto funcional com segurança mínima em andamento |
| v1.0 | SILO OPS Produção | C5.1 + C5.2 + C5.5 concluídos — pronto para primeiro cliente pagante |
| v1.1 | SILO OPS Enterprise | C5.3 + C5.4 + C5.6 concluídos — controle de acesso, estabilidade 24/7, material comercial |

---

## 8. Próxima Ação Imediata

**C5.1 — Hardening Produção**

Todos os componentes de C5.1 já foram implementados:

- `lib/auth/api-guard.ts` — guard central
- `lib/audit/audit-log.ts` — audit log JSONL
- `lib/security/rate-limit.ts` — rate limit in-memory
- `app/api/health/full/route.ts` — healthcheck
- `scripts/backup-data.sh` — backup script
- 8 rotas mobile protegidas
- Rotas web de escrita protegidas
- TypeScript validado sem erros novos

**Ação pendente:** Commit final de C5.1 e iniciar C5.2 — Multiempresa / Tenant Produção.
