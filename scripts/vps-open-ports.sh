#!/usr/bin/env sh
set -eu

if command -v ufw >/dev/null 2>&1; then
  ufw allow 3001/tcp
  ufw allow 3002/tcp
  ufw allow 3003/tcp
  ufw status numbered
  exit 0
fi

if command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port=3001/tcp
  firewall-cmd --permanent --add-port=3002/tcp
  firewall-cmd --permanent --add-port=3003/tcp
  firewall-cmd --reload
  firewall-cmd --list-ports
  exit 0
fi

echo "Firewall nao suportado automaticamente. Abra TCP 3001, 3002 e 3003 no security group/firewall da VPS."
exit 1
