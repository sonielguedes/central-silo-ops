# MANUAL DE OPERAÇÃO - FASE PILOTO (v0.1.0)
**Projeto:** SILO OPS Central  
**Público-alvo:** Administradores, Supervisores e Operadores COA.

---

## 1. Acesso ao Sistema
*   **URL:** `https://central.siloopsagro.com.br`
*   **Credenciais Iniciais:** Enviadas via e-mail corporativo.
*   **Primeiro Acesso:** No primeiro login, recomenda-se a alteração da senha no perfil do usuário.

---

## 2. Fluxos Principais

### A. Monitoramento em Tempo Real (Mapa)
1. Acesse o menu **Mapa Operacional**.
2. **Ícones:**
    - 🟢 **Verde:** Equipamento em movimento / Operando.
    - 🟡 **Amarelo:** Equipamento parado com motor ligado (Idling).
    - 🔴 **Vermelho:** Equipamento desligado ou sem sinal.
3. Clique em um ícone para ver detalhes: Velocidade, RPM, Último Operador e Nível de Sinal.

### B. Gestão de Checklists (Inspeção)
1. No menu **Frota > Checklists**, selecione o equipamento.
2. Realize a inspeção técnica marcando `CONFORME` ou `NÃO CONFORME`.
3. **Bloqueio Crítico:** Se um item marcado como **Crítico** for reprovado, o status do equipamento mudará automaticamente para **BLOQUEADO** no sistema, impedindo o início da jornada até a correção.

### C. Timeline de Eventos
1. Acesse **Operações > Timeline**.
2. Filtre por data ou equipamento para auditar:
    - Alterações de status (Ex: Operação -> Manutenção).
    - Início e fim de turnos.
    - Alertas críticos gerados por checklists.

---

## 3. Níveis de Permissão (RBAC)
*   **Supervisor COA:** Visão total de frota, aprovação de checklists e relatórios de produtividade.
*   **Operador:** Acesso apenas à realização de checklists e visualização do próprio status.
*   **Visualizador (Viewer):** Acesso apenas para leitura (dashboards e mapa).

---

## 4. Suporte Técnico
Em caso de inconsistência de dados ou falha de acesso:
1. Verifique sua conexão com a internet.
2. Limpe o cache do navegador (Ctrl + F5).
3. Entre em contato com o suporte N1 via canal oficial no Discord ou e-mail `suporte@siloopsagro.com.br`.

---
*Este manual é um documento vivo e será atualizado conforme a evolução da Etapa P2.*
