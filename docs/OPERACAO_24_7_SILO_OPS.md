# Operacao 24/7 - SILO OPS

## Objetivo

Manter a plataforma estável com backup diário, restauração previsível, verificação externa e limpeza controlada de logs.

## Rotina de backup

- Script principal: `scripts/backup-data.sh`
- Escopo:
  - backup full de `data/`
  - backup por tenant
  - inclusão de `.env.production` no backup full
- Retencao padrão:
  - 7 diários
  - 4 semanais
  - 3 mensais

### Exemplo de cron

```cron
0 2 * * * cd /opt/siloops-central && ./scripts/backup-data.sh --kind daily >> logs/backup-daily.log 2>&1
0 3 * * 0 cd /opt/siloops-central && ./scripts/backup-data.sh --kind weekly >> logs/backup-weekly.log 2>&1
0 4 1 * * cd /opt/siloops-central && ./scripts/backup-data.sh --kind monthly >> logs/backup-monthly.log 2>&1
```

## Healthcheck externo

- Script: `scripts/healthcheck.sh`
- Valida:
  - `GET /api/health/full`
  - container Docker em execução
  - espaço em disco
  - escrita em `data/`
- Saída:
  - `exit 0` quando tudo está OK
  - `exit 1` quando qualquer etapa falhar

### Uso padrão

```bash
./scripts/healthcheck.sh
```

### Uso em produção

```bash
HEALTH_URL=https://api.siloops.com.br/api/health/full CONTAINER_NAME=silo-piloto-web ./scripts/healthcheck.sh
```

## Limpeza de logs

- Script: `scripts/cleanup-old-logs.sh`
- Escopo:
  - remove logs antigos de `logs/`
  - não toca em `data/*/audit-log.jsonl`
- Ajuste de retenção:
  - `DAYS=30` por padrão

### Uso

```bash
./scripts/cleanup-old-logs.sh
```

## Diagnostico padrao

```bash
docker logs --tail 200 silo-piloto-web
curl -s http://127.0.0.1:3000/api/health/full | jq
./scripts/healthcheck.sh
df -h
find data -name 'audit-log.jsonl' -print
```

## Restauracao

- Checklist completo: `scripts/restore-backup.md`
- Regra critica:
  - nunca apagar `audit-log.jsonl`
  - restaurar `data/` antes de subir o Docker

