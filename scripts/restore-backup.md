# Restore Checklist

## Backup locations

- Daily full backups: `backups/daily/full/`
- Daily tenant backups: `backups/daily/tenants/`
- Weekly full backups: `backups/weekly/full/`
- Weekly tenant backups: `backups/weekly/tenants/`
- Monthly full backups: `backups/monthly/full/`
- Monthly tenant backups: `backups/monthly/tenants/`

## Full restore

1. Stop the stack.
   - `docker compose down`
2. Restore the latest full archive.
   - `tar -xzf backups/daily/full/siloops-daily-data-YYYYMMDD-HHMMSS.tar.gz -C /opt/siloops-central`
3. Restore `.env.production` if it exists inside the archive.
4. Start the stack again.
   - `docker compose up -d --build`

## Tenant restore

1. Stop the stack.
2. Restore the tenant archive.
   - `tar -xzf backups/daily/tenants/siloops-daily-tenant-<tenant>-YYYYMMDD-HHMMSS.tar.gz -C /opt/siloops-central/data`
3. Verify the tenant directory.
   - `ls -la /opt/siloops-central/data/<tenant>`
4. Start the stack again.
   - `docker compose up -d --build`

## .env.production restore

- If the backup archive contains `.env.production`, extract it to the project root.
- If not, restore it from the last known good copy before restarting Docker.

## Verification after restore

- `docker logs --tail 200 silo-piloto-web`
- `curl -s http://127.0.0.1:3000/api/health/full | jq`
- `./scripts/healthcheck.sh`
