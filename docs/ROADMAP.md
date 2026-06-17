# Roadmap — SILO OPS Central

**Data:** 2026-06-16  
**Versão atual:** v0.1.0-piloto  

---

## Estado atual

C5.1 (Segurança), C5.2 (Multi-tenant), C5.3 (RBAC) — **CONCLUÍDOS**

Sistema em piloto com 1 empresa real. Próximos marcos:

---

## Próximas prioridades (Fase Piloto → v1.0)

### 🔴 Bloqueadores imediatos (APK)

| Item | Status | Ação |
|------|--------|------|
| `operations >= 1` no bootstrap | ❌ Pendente | Cadastrar Operação no tenant piloto em `/operacoes` |
| Rate limiting em `middleware.ts` | ❌ Pendente | Implementar sliding window na camada de middleware Next.js |
| `npm run build` na VPS | ❌ Pendente | Rodar após cada deploy em `/opt/siloops-central` |
| Regenerar token SG01 | ❌ Pendente | Antes de entregar o QR Code ao cliente |

### 🟡 Infraestrutura (Fase 1 → Fase 2)

| Item | Descrição |
|------|-----------|
| Volumes Docker por tenant | Separar `./data` por tenant nos docker-compose services |
| Nginx TLS | Let's Encrypt no Nginx (atualmente HTTP) |
| Backup por tenant | `scripts/backup-data.sh` executando por tenant isolado |
| Monitoramento externo | UptimeRobot ou similar em `/api/mobile/health` |

---

## Melhorias planejadas (v1.1)

### APK (Riscos R1 e R2 do Dossiê de Prontidão)

- **R1:** Fila offline marca `tenantId` no flush, não na captura — risco de vazamento se dispositivo trocado de empresa com eventos pendentes
- **R2:** Sem bloqueio de troca de empresa com jornada ativa no APK

### Central Web

| Módulo | Melhoria |
|--------|---------|
| Relatórios | Endpoints de agregação + gráficos com dados reais + exportação PDF/CSV |
| Fazendas / Talhões | Geocerca automática (GPS ↔ talhão) |
| Checklists | `GET /api/mobile/checklists` para APK + UI de acompanhamento de execuções |
| Sincronização | Painel real com status por dispositivo |
| Dashboard | Gráfico de tendência 24h com histórico de snapshots |
| Importação | CSV de equipamentos e operadores |

---

## Versões

| Versão | Nome | Critério |
|--------|------|---------|
| v0.1.0 | Piloto | Estado atual — 1 empresa real, segurança mínima, RBAC completo |
| v1.0.0 | Produção | + volumes separados, TLS, backup automático, R1/R2 APK resolvidos |
| v1.1.0 | Enterprise | + relatórios completos, importação CSV, checklists APK, geocerca |

---

## Histórico de marcos concluídos

| Data | Marco |
|------|-------|
| 2026-06-08 | Plano de finalização v1.0 criado |
| 2026-06-13 | Auditoria técnica e de segurança pré-demo |
| 2026-06-16 | Centros de Custo, correção Paradas, Implementos (12 tipos/26 modelos), OS CSRF |
