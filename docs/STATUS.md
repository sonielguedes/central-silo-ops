# STATUS — SILO OPS Central

**Data de referência:** 2026-06-16  
**Responsável técnico:** Soniel  
**Versão:** v0.1.0-piloto  

---

## Estado Geral

| Dimensão | Status |
|----------|--------|
| Build (lint + type-check) | ✅ LIMPO |
| Build produção (next build) | NÃO VERIFICÁVEL NA SANDBOX — rodar na VPS |
| TypeScript | ✅ 0 erros |
| Testes de rota | ✅ Passando |
| Autenticação | ✅ Real (session cookie, NextAuth-compatible) |
| Multi-tenant | ✅ Implementado e auditado |
| CSRF | ✅ Double-submit cookie em todas as rotas de mutação |
| RBAC | ✅ Módulos + ações por role |
| Bootstrap APK | ⚠️ costCenters ✅ · operations = 0 (BLOQUEADOR APK) |

---

## Módulos — Estado Atual (2026-06-16)

| Módulo | Rota | Backend | Status |
|--------|------|---------|--------|
| Dashboard | `/dashboard` | `/api/equipamentos/status` | ✅ Dados reais |
| Mapa Operacional | `/mapa-operacional` | `/api/equipamentos/status` | ✅ Dados reais |
| Conectividade | `/monitoramento/conectividade` | `/api/equipamentos/status` | ✅ Dados reais |
| Equipamentos | `/frota` | `CadastroStorage` | ✅ Server-side |
| Tipos / Modelos | `/frota/tipos`, `/frota/modelos` | `CadastroStorage` | ✅ 12 tipos implemento + 26 modelos adicionados |
| Grupos / Perfis | `/frota/grupos`, `/frota/perfis` | `CadastroStorage` | ✅ Server-side |
| Checklists | `/frota/checklists` | `CadastroStorage` | ✅ Server-side |
| Estados Operacionais | `/frota/estados-operacionais` | `CadastroStorage` | ✅ Server-side |
| Implementos | `/frota/implementos` | `CadastroStorage` | ✅ Server-side · modelo opcional |
| Operadores | `/operadores` | `CadastroStorage` | ✅ Server-side |
| Fazendas / Talhões | `/fazendas-talhoes` | `CadastroStorage` | ✅ Server-side |
| **Centros de Custo** | `/centros-custo` | `/api/centros-custo` | ✅ Criado em 2026-06-16 |
| Motivos de Parada | `/paradas` | `CadastroStorage` | ✅ Server-side |
| Operações | `/operacoes` | `CadastroStorage` | ✅ Server-side |
| Ordens de Serviço | (sub-rota) | `CadastroStorage` | ✅ CSRF corrigido |
| Timeline | `/operacoes/timeline` | `mobile-events.json` | ✅ Dados reais |
| Abastecimentos | `/abastecimentos` | `CadastroStorage` | ✅ Server-side |
| Alertas | `/alertas` | `ServerStorage` | ✅ Motor real |
| Relatórios | `/relatorios/*` | `/api/relatorios/*` | ⚠️ Parcial — sub-rotas em desenvolvimento |
| Auditoria | `/relatorios/auditoria` | `audit-log.jsonl` | ✅ Server-side |
| Ficha Operador | `/ferramentas/ficha-operador` | `/api/equipamentos/status` | ✅ Dados reais |
| Adm. Empresas | `/administracao/empresas` | `ServerStorage` | ✅ Produção-ready |
| Adm. Usuários | `/administracao/usuarios` | `CadastroStorage` | ✅ Server-side |
| RBAC / Grupos | `/administracao/grupos-acesso` | `CadastroStorage` | ✅ Server-side |
| Configurações | `/configuracoes` | — | ⚠️ UI parcial |
| Sincronização | `/sincronizacao` | `/api/sync/status` | ✅ Real |

---

## Correções Recentes (esta sessão — 2026-06-16)

| Commit | Descrição |
|--------|-----------|
| `feat: add cost centers module for mobile bootstrap` | Módulo Centros de Custo completo: listagem, drawer CRUD, API `/api/centros-custo`, RBAC, sidebar, seed via `CadastroStorage` |
| `fix: map stop reason description to name` | Mapeamento correto de `description` → `name` nos motivos de parada |
| `fix: allow implements without model and preserve service order csrf` | Implementos: campo modelo opcional. OS: CSRF preservado nas mutações |
| `fix: send csrf token on service order mutations` | Ordens de Serviço: CSRF enviado corretamente |

---

## Pendências Técnicas

| Item | Prioridade | Observação |
|------|-----------|------------|
| `operations = 0` no bootstrap | 🔴 BLOQUEADOR APK | Operações precisam ser cadastradas para APK liberar tela de seleção |
| Rate limiting em `middleware.ts` | 🟡 Segurança | Auditoria 2026-06-16: 1 pendente |
| `npm run build` na VPS | 🟡 Validação | Executar em `/opt/siloops-central` após deploy |
| Regenerar token SG01 | 🟡 Operacional | Fazer antes de entregar ao cliente |
| Separar volumes Docker por tenant | 🟡 Segurança infra | Auditoria 2026-06-13: crítico de infra |

---

## Critério de Lançamento APK

O APK só libera a tela de Seleção Operacional quando `/api/mobile/bootstrap` retorna:
- `equipments.length >= 1` — pelo menos 1 equipamento mobile-enabled ativo
- `costCenters.length >= 1` — **✅ agora possível** (módulo criado)
- `stopReasons.length >= 1` — seeded para novos tenants
- `operations.length >= 1` — **❌ bloqueador** — nenhuma operação no seed padrão

**Próxima ação obrigatória:** Cadastrar pelo menos 1 Operação no tenant piloto via `/operacoes`.
