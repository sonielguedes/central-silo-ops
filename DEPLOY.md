# Deploy — SILO OPS Central

**VPS:** `/opt/siloops-central`  
**Data:** 2026-06-16  

---

## Primeira instalação

```bash
# Na VPS
cd /opt/siloops-central
git clone <repo> .
cp .env.example .env.production
nano .env.production   # preencher variáveis

docker-compose up -d --build
```

---

## Atualização (deploy de nova versão)

```bash
cd /opt/siloops-central
git pull origin main
npm run type-check     # validar TypeScript antes de buildar
npm run build          # build de produção
docker-compose down && docker-compose up -d --build
```

---

## Variáveis de ambiente (.env.production)

| Variável | Descrição |
|----------|-----------|
| `NEXTAUTH_SECRET` | Segredo de sessão (mínimo 32 chars) |
| `NEXTAUTH_URL` | URL pública da aplicação |
| `NEXT_PUBLIC_API_URL` | URL da API para o frontend |
| `NEXT_PUBLIC_APP_ENV` | `production` ou `demo` |
| `DATA_DIR` | Diretório de dados (padrão: `./data`) |

---

## Estrutura Docker

```yaml
services:
  silo-piloto:      # Tenant piloto — porta 3001
  silo-cliente-02:  # Tenant 2 — porta 3002
  silo-cliente-03:  # Tenant 3 — porta 3003
```

> **Atenção:** Separar volumes por tenant. Não usar `./data:/app/data` compartilhado entre services.

```yaml
# Correto:
silo-piloto:
  volumes: - ./data/silo-piloto:/app/data
silo-cliente-02:
  volumes: - ./data/silo-cliente-02:/app/data
```

---

## Nginx

```nginx
server {
    listen 443 ssl;
    server_name siloopsagro.com.br;
    ssl_certificate /etc/letsencrypt/live/siloopsagro.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/siloopsagro.com.br/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

---

## Backup

```bash
# Manual
bash scripts/backup-data.sh

# Automático via cron (diário às 02:00)
0 2 * * * /opt/siloops-central/scripts/backup-data.sh
```

Arquivo gerado: `backups/siloops-data-YYYYMMDD-HHMMSS.tar.gz`

---

## Healthcheck

```bash
curl https://siloopsagro.com.br/api/mobile/health
# {"status":"ok","version":"0.1.0","timestamp":"..."}

curl https://siloopsagro.com.br/api/health/full
# Retorna status completo (app, disco, dados)
```

---

## Validações pós-deploy

```bash
npm run lint         # deve passar sem erros
npm run type-check   # deve passar sem erros
npm run build        # deve concluir sem erros (executar na VPS)
```

---

## Logs

```bash
docker-compose logs -f silo-piloto
docker logs silo-piloto --tail 100
```

---

## Restore de backup

Ver `scripts/restore-backup.md` para procedimento completo.
