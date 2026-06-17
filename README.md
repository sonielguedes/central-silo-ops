# SILO OPS Central

**Sistema de Inteligência Logística Operacional**  
**Versão:** v0.1.0-piloto · **Stack:** Next.js 14 (App Router) + TypeScript + Docker  
**Última atualização:** 2026-06-16  

---

## O que é

SILO OPS Central é a interface web de gestão do sistema SILO OPS — plataforma multiempresa (multi-tenant) para gestão agrícola operacional em tempo real.

Composta por:
- **Central Web** (este repositório) — gestão de frotas, operadores, cadastros, dashboard, mapa, relatórios
- **APK Field** (repositório Android) — app de campo para operadores, com jornada, GPS, paradas e eventos offline-first

---

## Pré-requisitos

- Node.js 20+
- Docker + docker-compose (para deploy)
- VPS com Ubuntu 22+ (deploy em `/opt/siloops-central`)

---

## Desenvolvimento local

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
npm run type-check   # tsc --noEmit
npm run lint         # ESLint
```

> `npm run build` excede o timeout da sandbox local — executar sempre na VPS.

---

## Deploy

Ver `DEPLOY.md` para instruções completas.

---

## Estrutura de dados

```
data/
  {tenantId}/
    cadastro-equipamentos.json
    cadastro-operadores.json
    cadastro-paradas.json
    cadastro-centros-custo.json
    cadastro-operacoes.json
    mobile-events.json
    live-state.json
    alerts.json
    audit-log.jsonl
```

Cada empresa opera em seu próprio subdiretório. O `tenantId` é derivado exclusivamente do token da empresa — nunca de headers enviados pelo cliente.

---

## Documentação técnica

| Documento | Descrição |
|-----------|-----------|
| `docs/STATUS.md` | Estado atual de todos os módulos |
| `docs/ARQUITETURA.md` | Stack, auth, CadastroStorage, RBAC, CSRF |
| `docs/MOBILE_BOOTSTRAP.md` | Rota `/api/mobile/bootstrap` — dados para o APK |
| `docs/API_MOBILE.md` | Referência completa da API Mobile |
| `docs/ROADMAP.md` | Próximas prioridades e versões |
| `docs/CHECKLIST_PILOTO.md` | Checklist go-live para novo tenant |
| `docs/PRONTIDAO_COMERCIAL_SILO_OPS.md` | Dossiê de segurança e prontidão comercial |
| `docs/AUDITORIA_TECNICA_2026-06-13.md` | Auditoria técnica pré-demo |

---

## Segurança

- Autenticação real via session cookie (não mock)
- CSRF: double-submit cookie em todas as mutações
- RBAC: módulo + ação por role
- Multi-tenant: isolamento físico por diretório `data/{tenantId}`
- Auditoria: `audit-log.jsonl` por tenant
- Rate limiting: sliding window nas rotas sensíveis

---

## Responsável

Soniel · sonieloficial@gmail.com
