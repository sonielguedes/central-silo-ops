#!/usr/bin/env sh
set -eu

HOST="${1:-http://127.0.0.1}"

curl -fsS "$HOST:3001/api/mobile/equipment/lookup?fleetCode=COL-101"
printf "\n"

for port in 3002 3003; do
  status="$(curl -s -o /dev/null -w "%{http_code}" "$HOST:$port/api/mobile/equipment/lookup?fleetCode=COL-101")"
  if [ "$status" != "404" ]; then
    echo "Falha: porta $port retornou $status para frota do piloto; esperado 404"
    exit 1
  fi
done

echo "OK: portas 3001/3002/3003 respondem e nao vazam frota do piloto."
