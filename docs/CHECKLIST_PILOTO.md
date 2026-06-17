# Checklist Go-Live — Piloto SILO OPS

**Data de referência:** 2026-06-16  
**Versão:** v0.1.0-piloto  

---

## Pré-requisitos de infraestrutura

- [ ] VPS provisionada com Docker + docker-compose
- [ ] Nginx configurado com TLS (Let's Encrypt)
- [ ] Portas 443 (HTTPS) e MQTT abertas no firewall
- [ ] Backup automático configurado (`scripts/backup-data.sh` via cron)
- [ ] Healthcheck externo ativo (`GET /api/mobile/health`)
- [ ] Variáveis de ambiente `.env.production` revisadas

---

## Provisionamento do tenant piloto

- [ ] Empresa criada em `/administracao/empresas` com `companyCode`, `apiBaseUrl`, `mqttHost/porta`
- [ ] Token gerado via "Gerar QR Code" ou "Gerar Token"
- [ ] QR Code gerado e testado (auditoria `COMPANY_TOKEN_VIEWED (qr)` registrada)
- [ ] Usuário administrador da empresa criado (senha temporária entregue, troca obrigatória no 1º login)

---

## Cadastros mínimos obrigatórios

- [ ] **Equipamentos:** ≥ 1 equipamento com `mobileEnabled = true` e `entityStatus = ATIVO`
- [ ] **Centros de Custo:** ≥ 1 centro de custo com `status = ATIVO` ← obrigatório para bootstrap APK
- [ ] **Motivos de Parada:** ≥ 1 motivo ativo ← seeded automaticamente para novos tenants
- [ ] **Operações:** ≥ 1 operação não finalizada ← **BLOQUEADOR APK** — cadastrar em `/operacoes`
- [ ] **Operadores:** ≥ 1 operador cadastrado (matrícula para login no APK)

---

## Validação do APK

- [ ] APK instalado no dispositivo de campo (Android 10+)
- [ ] Dispositivo lê o QR Code: `POST /api/mobile/company/validate` retorna 200
- [ ] `GET /api/mobile/bootstrap` retorna arrays não-vazios para equipments, costCenters, stopReasons, operations
- [ ] Login por matrícula do operador bem-sucedido no APK
- [ ] Jornada iniciada (`POST /api/mobile/shift/start` → 200)
- [ ] GPS / heartbeat chegando na Central (visível no mapa operacional em ≤ 30s)
- [ ] Parada registrada pelo operador e visível na timeline
- [ ] Jornada encerrada (`POST /api/mobile/shift/end` → 200)
- [ ] Dashboard / mapa mostram dados corretos do tenant piloto

---

## Segurança pré-entrega

- [ ] Token SG01 regenerado antes de entregar ao cliente
- [ ] Volumes Docker separados por tenant (não compartilhados)
- [ ] Rate limiting ativo em `middleware.ts`
- [ ] `npm run build` executado na VPS sem erros
- [ ] Audit log revisado: nenhuma ação suspeita registrada

---

## Pós go-live (1 semana)

- [ ] 1 semana de jornadas reais sem mistura de dados entre tenants
- [ ] Taxa de sincronização APK > 95% (sem perda de eventos)
- [ ] Sem alertas críticos não reconhecidos
- [ ] Backup diário testado e restore validado
- [ ] Aceite operacional assinado pelo responsável do cliente

---

## Critérios de promoção F1 → F2

- 1 semana de jornadas reais validadas (Fase 1 concluída)
- Volumes Docker separados por tenant
- Rate limiting em middleware.ts implementado
- R1 e R2 do Dossiê de Prontidão endereçados (fila offline por tenant, bloqueio de troca com jornada ativa)
