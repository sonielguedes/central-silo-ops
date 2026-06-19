# ETAPA 6.13C — Deploy VPS + Validação de Segurança em Produção

**Data:** 2026-06-19
**Destino:** VPS / Produção — central.siloops.com.br
**Status:** ⏳ AGUARDANDO EXECUÇÃO NA VPS

## Contexto

Esta etapa finaliza as ETAPAs 6.13A e 6.13B, aplicando as correções de segurança em produção.

## O que foi preparado nesta etapa

### Script de deploy automatizado
`scripts/deploy-6.13c.sh` — cobre todas as etapas do spec:
- Backup de `.env.production` e `/opt/siloops-data`
- git fetch + reset --hard origin/main + restauração do .env
- npm ci → lint → type-check → build
- docker compose --env-file .env.production up -d --build
- 16 validações automáticas via curl

### Validação local pré-deploy (código na branch main)
Todos os itens verificados antes de enviar à VPS:

| Item | Status |
|------|--------|
| `middleware.ts` existe | ✅ |
| `/login` na lista de rotas públicas | ✅ |
| `/api/mobile/*` não bloqueado pelo middleware (APK funciona) | ✅ |
| `/api/auth/*` não bloqueado | ✅ |
| `/api/health/*` não bloqueado | ✅ |
| `X-Frame-Options` em next.config.js | ✅ |
| `Strict-Transport-Security` em next.config.js | ✅ |
| `Content-Security-Policy` em next.config.js | ✅ |
| Token mobile inválido → 401 (código api-guard.ts) | ✅ |
| X-Tenant-Id divergente → 403 (código api-guard.ts) | ✅ |
| CSRF usa `timingSafeEqual` | ✅ |
| 45/45 testes de segurança passando | ✅ |

## Validações pendentes (requerem execução na VPS)

Executar na VPS:
```bash
cd /opt/siloops-central
bash scripts/deploy-6.13c.sh TOKEN_DESTILARIA_TABU TOKEN_SEEME
```

### Checklist de aprovação pendente

| Validação | Método | Esperado |
|-----------|--------|---------|
| VPS atualizada com commit correto | git log | HEAD = último commit |
| .env.production preservado | diff | Igual ao backup |
| Backup realizado | ls /root/siloops-backups | Arquivos .bak e .tar.gz |
| Build de produção | npm run build | Exit 0 |
| Containers sobem | docker compose ps | Up |
| /dashboard sem login | curl -i (não segue redirect) | 302 → /login |
| /mapa-operacional sem login | curl -i | 302 → /login |
| /instancias sem login | curl -i | 302 → /login |
| /login acessível | curl -i | 200 |
| /api/health acessível | curl -i | 200 |
| /api/mobile/health acessível | curl -i | 200 (APK não bloqueado) |
| X-Frame-Options header | curl -I | Presente |
| X-Content-Type-Options header | curl -I | Presente |
| Content-Security-Policy header | curl -I | Presente |
| Strict-Transport-Security header | curl -I | Presente |
| Token mobile inválido | curl POST | 401 |
| Token A + Tenant B | curl POST | 403 |
| Token B + Tenant A | curl POST | 403 |
| Token A correto | curl POST | 200 |
| /opt/siloops-data/{tenantId}/ | ls | Separado por empresa |
| Logs sem passwords/tokens completos | docker logs grep | 0 matches |

## Comando de uso do script

```bash
# Na VPS como root:
cd /opt/siloops-central
bash scripts/deploy-6.13c.sh TOKEN_DESTILARIA_TABU TOKEN_SEEME
```

O script imprime `ETAPA 6.13C DEPLOY VPS SEGURANÇA PRODUÇÃO: APROVADO` se todos os testes passarem.

## Erros de type-check pré-existentes (não bloqueiam build)

Os seguintes erros existiam antes da ETAPA 6.13 e não foram introduzidos pelas mudanças:

| Arquivo | Erro | Tipo |
|---------|------|------|
| `app/timeline/page.tsx:22` | TS6133: 'Calendar' importado mas não usado | Pré-existente |
| `lib/equipment-trail-store.ts:1` | TS2459: 'TrailPoint' não exportado | Pré-existente |
| `lib/mobile/hourmeter.ts:4` | TS6133: 'EquipmentLiveState' não usado | Pré-existente |
| `lib/timeline.ts:91` | TS2322: Type 'string' não atribuível a 'TimelineEventType' | Pré-existente |

Estes erros não bloqueiam `npm run build` (Next.js ignora erros TS durante build por padrão).

## Arquivos Criados

- `scripts/deploy-6.13c.sh` ← NOVO — script automatizado de deploy e validação
- `docs/superpowers/plans/2026-06-19-deploy-vps-validacao-seguranca-producao.md` ← NOVO
