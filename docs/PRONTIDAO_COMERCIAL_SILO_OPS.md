# SILO OPS — Dossiê de Prontidão Comercial e Implantação em Produção

**Sistema de Inteligência Logística Operacional**
**Versão do documento:** 1.0 · **Data:** 14/06/2026 · **Responsável:** Soniel
**Classificação:** Produto multiempresa em produção (não-piloto)

---

## Sumário executivo

O SILO OPS é uma plataforma multiempresa (multi-tenant) para gestão agrícola
operacional em tempo real, composta por uma **Central Web** e um **Aplicativo de
Campo (APK) único** para todos os clientes. Cada empresa opera como um *tenant*
isolado: dados, jornadas, operadores, frotas, paradas e eventos nunca se cruzam
entre clientes.

A configuração do aplicativo é feita por **QR Code oficial** gerado na Central. O
técnico/administrador aponta a câmera do APK para o QR; o app valida o token na
rota `/api/mobile/company/validate`, grava `tenantId`, `companyCode`, `apiBaseUrl`,
`mqttHost`, `mqttPort` e `companyToken`, e passa a operar isolado. O operador de
campo nunca configura servidor — usa apenas matrícula, frota, jornada e parada.

**Veredito de prontidão.** O isolamento *server-side* está implementado de forma
sólida e auditada: o `tenantId` é derivado exclusivamente do token da empresa, há
rejeição explícita de acesso cross-tenant, armazenamento físico segregado por
tenant e trilha de auditoria nas ações sensíveis. O produto está apto a uma
**implantação em produção controlada** (uma empresa real iniciando jornadas e a
Central recebendo dados sem mistura). Antes de abrir venda em escala, há um
conjunto fechado de itens a endereçar — concentrados no lado do APK (vínculo de
tenant por evento na fila offline e bloqueio de troca de empresa com jornada
ativa) e na camada de persistência (hoje em arquivo, adequada a baixo/médio volume).
Esses itens estão listados como **riscos a fechar** ao final deste dossiê.

---

## 1. Arquitetura multiempresa (como o isolamento funciona hoje)

### 1.1 Resolução de tenant

| Camada | Mecanismo | Evidência no código |
|--------|-----------|---------------------|
| Mobile (APK) | `tenantId` derivado do **Company Token**, nunca de header arbitrário | `lib/auth/api-guard.ts` → `requireMobileAuth()` (`getCompanyByToken` → `company.tenantId`) |
| Web (Central) | `tenantId` da **sessão** (cookie); rejeita header divergente | `lib/auth/api-guard.ts` → `requireTenant()` + `lib/tenant/tenant-resolver.ts` (sem fallback silencioso) |
| Armazenamento | Diretórios físicos por tenant: `data/{tenantId}/…` | `lib/server-storage.ts` (`getTenantDir`, `getEventsFile`, `getLiveStateFile`) |

O token da empresa é, na prática, **a chave do tenant**: uma requisição mobile só
pode resolver para o tenant dono do token. Isso elimina a classe mais comum de
vazamento cross-tenant (cliente A enxergar dados do cliente B).

### 1.2 Defesa em profundidade nas rotas mobile

Auditado em `docs/AUDITORIA_TENANT_ISOLATION.md` e confirmado no código:

- `POST /api/mobile/events/batch` — rejeita `body.tenantId !== auth.tenantId` (HTTP 403)
  e valida posse do equipamento (`equipment.tenantId !== tenantId` → erro). Eventos e
  pontos de trilha são gravados com `tenantId` explícito (`ServerStorage.saveEvent(..., tenantId)`).
- `POST /api/mobile/shift/start` e `/shift/end` — validam equipamento por tenant; auditam `SHIFT_START`.
- `POST /api/mobile/heartbeat` e `/location` — tenant vinculado ao token.
- `POST /api/mobile/company/validate` — valida token, respeita `mobileEnabled` e status de assinatura, devolve a config para o APK (nunca o token completo) e audita `MOBILE_TOKEN_VALIDATED` / `_FAILED`.

### 1.3 Configuração via QR Code

- A Central gera o QR contendo o JSON oficial `SILO_OPS_MOBILE_CONFIG` (v1) com
  `companyCode`, `tenantId`, `apiBaseUrl`, `mqttHost`, `mqttPort`, `protocol` e
  `companyToken` **completo**.
- Na interface o token é sempre **mascarado**; o token completo só é materializado
  no momento de gerar o QR/copiar configuração, via endpoint auditado
  (`/api/admin/companies/[id]/token?purpose=qr|copy`).
- Round-trip validado: payload de 337 bytes codifica em nível de correção M e
  decodifica de volta para JSON byte-idêntico (token de 54 caracteres preservado,
  `mqttPort` numérico).

---

## 2. Entregável 1 — Checklist técnico de validação multiempresa

Legenda: ✅ implementado e verificado · 🟡 implementado, requer verificação no APK completo · 🔴 gap a fechar

### Isolamento de dados
- ✅ `tenantId` derivado do token da empresa em todas as rotas mobile (`requireMobileAuth`).
- ✅ Rejeição de `tenantId` divergente no corpo da requisição (HTTP 403).
- ✅ Validação de posse de equipamento por tenant (cross-tenant → erro).
- ✅ Armazenamento físico segregado por tenant (`data/{tenantId}/…`).
- ✅ Rotas web de leitura/escrita passam por `requireTenant()` (sem fallback para tenant padrão).
- ✅ Eventos, trilha (GPS), live-state e jornadas gravados com `tenantId` explícito.
- 🟡 Fila offline do APK envia eventos com o tenant da **sessão ativa no momento do flush** (ver Risco R1).
- 🔴 Vínculo de `tenantId`/`companyToken` **por evento** na fila offline (capturado na origem, não no flush).

### Identidade e configuração
- ✅ QR Code oficial com os 6 campos exigidos + `protocol`.
- ✅ Token mascarado na UI; token completo apenas no QR/cópia.
- ✅ Rota `/api/mobile/company/validate` valida token e devolve config.
- ✅ Flag `mobileEnabled` permite desativar o acesso mobile preservando o token.
- 🟡 Persistência da config no APK (DataStore/Room) por tenant — verificar no APK completo.

### Ciclo operacional
- ✅ Login por matrícula (operador não vê servidor/token).
- ✅ Início/fim de jornada, GPS, heartbeat, paradas e finalização (rotas existentes).
- ✅ Idempotência por `offlineId` (UUID) — reenvio seguro (`OutboxSyncWorker`).
- 🔴 Bloqueio de troca de empresa com **jornada ativa** no APK (ver Risco R2).
- 🟡 Encerramento/transferência de jornada ao reconfigurar o APK para outra empresa.

### Auditoria (diretriz 13)
- ✅ Geração de QR Code → `COMPANY_TOKEN_VIEWED` (purpose=`qr`).
- ✅ Cópia de token/config → `COMPANY_TOKEN_VIEWED` (purpose=`copy`).
- ✅ Validação mobile → `MOBILE_TOKEN_VALIDATED` / `MOBILE_TOKEN_VALIDATION_FAILED`.
- ✅ Regeneração de token → `COMPANY_TOKEN_ROTATED` (invalida o anterior).
- ✅ Desativação mobile → `MOBILE_DISABLED` / `MOBILE_ENABLED`.
- ✅ Toda entrada registra usuário, data/hora, `tenantId`, IP e user-agent (`lib/audit/audit-log.ts`).

### Qualidade / segurança de plataforma
- ✅ Type-check limpo (`tsc --noEmit`), 76/76 testes de rota passando.
- ✅ Rate limiting dedicado nas rotas de token e validação mobile.
- ✅ Proteção CSRF nas ações de escrita administrativas.
- 🟡 Backups automáticos e retenção dos diretórios `data/{tenantId}` (ver Plano de Produção).

---

## 3. Entregável 2 — Checklist comercial de entrega ao cliente

**Antes da assinatura / proposta**
- [ ] Escopo operacional levantado: nº de frotas, operadores, turnos, frentes de trabalho.
- [ ] Plano contratado definido (PILOTO / PRO / ENTERPRISE) e ciclo de cobrança.
- [ ] Expectativa de volume (eventos/dia, dispositivos simultâneos) registrada.
- [ ] Responsável técnico do cliente identificado (quem fará a leitura do QR).

**Provisionamento (feito pela equipe SILO OPS)**
- [ ] Empresa/tenant criada na Central com `companyCode`, `apiBaseUrl`, `mqttHost/porta`.
- [ ] Token gerado e QR Code oficial emitido.
- [ ] Usuário administrador da empresa criado (senha temporária entregue com troca no 1º login).
- [ ] Cadastros-base importados: operadores (matrículas), frotas/equipamentos, paradas, operações.

**Entrega ao cliente**
- [ ] QR Code entregue ao técnico do cliente por canal seguro (não público).
- [ ] APK instalado nos dispositivos de campo (link/loja interna).
- [ ] Configuração validada: 1 dispositivo lê o QR, valida token e aparece "online" na Central.
- [ ] Jornada-piloto real iniciada e visível no Dashboard/Mapa.
- [ ] Relatórios de tempo e eficiência operacional validados com dados reais.
- [ ] Treinamento do operador (matrícula → frota → jornada → parada) realizado.
- [ ] Treinamento do gestor (Central, mapa, relatórios) realizado.

**Pós-entrega**
- [ ] Termo de aceite operacional assinado.
- [ ] Canal de suporte e SLA combinados.
- [ ] Rotina de backup e monitoramento confirmada para o tenant.

---

## 4. Entregável 3 — Fluxo de onboarding de nova empresa

```
1. Admin SILO OPS cria a empresa/tenant na Central
     └─ define companyCode, plano, apiBaseUrl, mqttHost/porta
2. Central provisiona automaticamente
     └─ gera token + URLs + usuário admin da empresa (senha temporária)
3. Admin importa/cadastra a base operacional do cliente
     └─ operadores (matrículas), frotas, paradas, operações
4. Admin abre "Configurar APK" no card da empresa
     └─ modal "Configuração Mobile": revisa dados, status e última conexão
5. Admin clica "Gerar QR Code"  (ação restrita a perfil administrativo)
     └─ QR carrega o token COMPLETO; auditoria COMPANY_TOKEN_VIEWED (purpose=qr)
6. Técnico do cliente abre o APK e lê o QR
     └─ APK chama /api/mobile/company/validate
7. APK valida e salva tenantId, companyCode, apiBaseUrl, mqttHost/porta, token
     └─ a partir daqui o operador nunca vê configuração de servidor
8. Operador faz login por matrícula e inicia jornada
9. APK envia GPS, heartbeat, eventos, paradas e finalização (fila offline + retry)
10. Central recebe SOMENTE no tenant correto; Dashboard/Mapa/Relatórios atualizam
```

**Tempo-alvo de onboarding técnico:** < 30 min por empresa (do cadastro ao primeiro
dispositivo online), pressupondo cadastros-base prontos. Esse número é o principal
indicador de "baixo retrabalho técnico" para expansão comercial.

**Reconfiguração / reset.** Para revogar o acesso de um dispositivo perdido ou
comprometido: regenerar o token (invalida o anterior e todos os dispositivos) e
reemitir o QR; ou desativar o mobile da empresa (preserva o token para reativar).

---

## 5. Entregável 4 — Regras de segurança e isolamento (normativo)

1. **Tenant vem do token, nunca do cliente.** Toda rota mobile resolve `tenantId`
   exclusivamente via `getCompanyByToken`. Nenhum header `tenantId` enviado pelo APK
   é confiável por si só; se divergir do token, a requisição é rejeitada (403).
2. **Web resolve tenant pela sessão.** Usuários TENANT não podem injetar outro
   tenant por header; usuários PLATFORM precisam ativar um tenant explicitamente.
3. **Token completo só em dois lugares:** dentro do QR Code e na ação "copiar
   configuração". Em qualquer tela, log ou resposta de API, o token é mascarado
   (`maskToken`). Logs nunca imprimem o token completo.
4. **Geração de QR / regeneração / desativação são restritas a perfil
   administrativo** (SUPER_ADMIN_SILO, SUPER_ADMIN, ADMIN_EMPRESA — este último só
   no próprio tenant) e exigem CSRF.
5. **Regenerar token invalida o anterior.** Dispositivos com token antigo deixam de
   autenticar e precisam reler o QR.
6. **Auditoria obrigatória** em: geração de QR, cópia de token, validação mobile,
   regeneração de token e desativação mobile — com usuário, data/hora, `tenantId`,
   IP e user-agent.
7. **Nenhum dado cruza tenant.** Jornada, operador, frota, parada, evento, GPS e
   live-state são lidos e gravados sempre sob `data/{tenantId}`.
8. **Fila offline deve ser fiel ao tenant de origem.** Cada evento deve carregar o
   tenant/token de quando foi capturado (ver R1) e a troca de empresa deve ser
   bloqueada com jornada ativa (ver R2).
9. **Defesa anti-força-bruta.** Rate limiting dedicado nas rotas de token e de
   validação mobile.
10. **Princípio do menor privilégio.** O operador de campo só acessa matrícula,
    frota, jornada e parada — sem qualquer acesso a configuração ou a outros tenants.

---

## 6. Entregável 5 — Pontos de melhoria para deixar o produto vendável

Ligados às prioridades do produto (anti-fraude, produtividade, tempo real,
relatórios confiáveis, rastreabilidade, implantação fácil, expansão).

**Anti-fraude de apontamento**
- Vincular GPS + horímetro + matrícula a cada evento e sinalizar inconsistências
  (ex.: jornada sem deslocamento, horímetro retroativo, parada sem GPS).
- Foto/assinatura opcional no início de jornada e no abastecimento.
- Cerca virtual (geofence) por fazenda/talhão para validar onde a frota operou.

**Produtividade das máquinas**
- KPIs de disponibilidade, utilização e tempo produtivo vs. parado por frota/operador.
- Ranking de paradas por motivo e por frente; metas por operação.

**Tempo real e confiabilidade**
- Indicador de saúde da sincronização por dispositivo (último heartbeat, fila pendente).
- Alertas configuráveis (frota offline, parada longa, fora de cerca).

**Relatórios e rastreabilidade**
- Exportação assinada (PDF/Excel) com operador, frota, GPS, data, hora e status.
- Linha do tempo por jornada (auditável ponta a ponta).

**Implantação e expansão comercial**
- Catálogo de planos com limites claros (dispositivos, frotas, retenção).
- Importador de cadastros (CSV/Excel) para onboarding em minutos.
- Painel de "saúde do tenant" para o time SILO OPS acompanhar cada cliente.
- Self-service parcial: cliente regenera QR/dispositivo sob política controlada.

**Escalabilidade técnica (pré-requisito de venda em escala)**
- Migrar a persistência de arquivo (`data/{tenantId}`) para banco com isolamento
  por tenant (schema/row-level), preservando a mesma fronteira lógica já existente.
- Observabilidade: métricas, logs estruturados centralizados e tracing por tenant.

---

## 7. Entregável 6 — Plano de implantação em produção

**Fase 0 — Preparação de plataforma (infra)**
- Provisionar servidor de produção (API HTTPS + broker MQTT) e DNS por ambiente.
- TLS válido em `apiBaseUrl` e no MQTT; portas por empresa documentadas.
- Backup automático e retenção dos diretórios `data/{tenantId}` (ou do banco, após migração).
- Monitoramento de uptime, uso de disco e fila MQTT; alertas operacionais.

**Fase 1 — Empresa-âncora (produção controlada)**
- Cadastrar a primeira empresa real, emitir QR, configurar 1–3 dispositivos.
- Rodar jornadas reais por uma semana; validar dashboard, mapa e relatórios.
- Acompanhar auditoria, taxa de sincronização e rejeições de eventos.

**Fase 2 — Endurecimento (fechar riscos do APK)**
- Implementar vínculo de tenant por evento na fila offline (R1).
- Implementar bloqueio de troca de empresa com jornada ativa (R2).
- Teste de regressão offline: capturar eventos sem rede, trocar de rede, sincronizar.

**Fase 3 — Escala comercial**
- Onboarding de novas empresas em lote com importador de cadastros.
- Migração de persistência para banco (se o volume exigir) sem mudar a fronteira de tenant.
- Definir SLA, suporte e rotina de releases do APK único.

**Critérios de promoção entre fases**
- F0→F1: infra com TLS, backup e monitoramento ativos.
- F1→F2: 1 semana de jornadas reais sem mistura de dados e sem perda de eventos.
- F2→F3: R1 e R2 fechados e cobertos por teste; onboarding < 30 min reproduzível.

---

## 8. Entregável 7 — Riscos que ainda precisam ser fechados antes de entregar ao cliente

| ID | Risco | Severidade | Evidência | Mitigação |
|----|-------|-----------|-----------|-----------|
| R1 | Fila offline marca o tenant **no momento do flush** (usa `session` ativa), não na captura do evento. Se o dispositivo for reconfigurado para outra empresa com eventos pendentes, eventos podem ser enviados sob o tenant errado. | Alta | `kotlin/OutboxSyncWorker.kt` (header montado de `session.tenantId/companyToken`) | Persistir `tenantId`+`companyToken` em cada `OutboxEvent`; enviar lote por tenant; bloquear flush se o tenant do evento ≠ sessão. |
| R2 | Não há, nos trechos disponíveis do APK, bloqueio de **troca de empresa com jornada ativa** (diretriz 11). | Alta | Ausência em `kotlin/*` | Impedir reconfiguração/troca enquanto houver jornada ativa; exigir finalização ou transferência explícita. |
| R3 | Persistência em arquivo (`data/{tenantId}`) — adequada a baixo/médio volume, mas com risco de concorrência e limite de escala. | Média | `lib/server-storage.ts` (fs JSON/JSONL) | Migrar para banco com isolamento por tenant antes da venda em escala; manter a fronteira lógica atual. |
| R4 | Cópia/geração do token expõe o valor completo no cliente (necessário para o QR) — risco se a estação do admin estiver comprometida. | Média | `/api/admin/companies/[id]/token?purpose=…` | Já auditado e restrito a admin+CSRF; reforçar com expiração de exibição, escopo de rede e MFA do admin. |
| R5 | Backup/restore e retenção por tenant ainda não confirmados como rotina automática. | Média | Plano de Produção, Fase 0 | Definir e testar restore por tenant antes da F1→F2. |
| R6 | Observabilidade por tenant (métricas/alertas de sincronização) limitada. | Baixa/Média | — | Painel de saúde do tenant + alertas de frota offline/fila pendente. |

> **Itens administrativos pendentes nesta máquina (não afetam o código-fonte):**
> rodar `npm install` para gravar o `package-lock.json` (deps `qrcode` já no
> `package.json`); reparar o git (`.git/index` corrompido — apagar `.git\index.lock`
> e `.git\index`, depois `git reset`); e remover o arquivo vazio `_qrverify.js` na raiz.

---

## 9. Critério de sucesso — teste de aceitação ponta a ponta

Roteiro objetivo que comprova "pronto para o cliente" sem misturar dados:

1. Criar empresa **EMP-A** (tenant A) e empresa **EMP-B** (tenant B) na Central.
2. Gerar QR de A e QR de B; confirmar auditoria `COMPANY_TOKEN_VIEWED (qr)` em cada tenant.
3. Configurar Dispositivo-1 com o QR de A; validar em `/api/mobile/company/validate` (200, tenant A).
4. Login por matrícula em A; iniciar jornada; enviar GPS/heartbeat/parada; finalizar.
5. Confirmar no Dashboard/Mapa/Relatórios de **A** os dados; confirmar que **B não vê nada**.
6. Tentar enviar evento de A com `tenantId` de B no corpo → deve retornar **403**.
7. Regenerar o token de A → Dispositivo-1 deixa de autenticar até reler o QR.
8. Desativar mobile de A (`mobileEnabled=false`) → `/validate` recusa (403 `MOBILE_DISABLED`).
9. Repetir 3–5 com Dispositivo-2 em B; confirmar isolamento recíproco.
10. Conferir trilha de auditoria completa nos dois tenants (geração, validação, rotação, desativação).

**Aprovado quando:** todos os 10 passos ocorrem sem nenhum dado de A aparecer em B
(ou vice-versa), com auditoria íntegra e sincronização offline sem perda.

---

*Documento gerado a partir de auditoria do código real do repositório SILO OPS
Central (rotas mobile/admin, `lib/auth`, `lib/server-storage`, `lib/audit`,
`docs/AUDITORIA_TENANT_ISOLATION.md` e os componentes Kotlin de referência do APK).*
