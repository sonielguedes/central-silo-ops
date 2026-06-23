# HOTFIX 6.11A — CORREÇÃO DE RESPOSTA HTML NO VÍNCULO DE DISPOSITIVO

**Data:** 2026-06-18
**Status:** IMPLEMENTADO
**Módulos afetados:** APK (Android), Central (Node.js/Next.js)

## Problema
Ao tentar vincular um dispositivo na tela de "Configuração do Dispositivo", o APK recebia uma resposta em formato HTML em vez de JSON quando ocorria um erro (ex: 404, 405 ou unauth). Isso causava a exibição de tags HTML brutas na interface do usuário, dificultando o diagnóstico para o operador.

## Causa Raiz
1. **Central:** Algumas rotas de API mobile não tratavam explicitamente métodos não permitidos ou erros de parsing de JSON, permitindo que o Next.js retornasse páginas de erro HTML padrão.
2. **APK:** O repositório de vínculo não verificava o `Content-Type` da resposta antes de tentar ler o corpo do erro, exibindo qualquer conteúdo retornado pelo servidor.

## Correções Aplicadas

### 1. Central (Hardening de API Mobile)
- **Catch-all API Route:** Criada a rota `app/api/[...catchall]/route.ts` para capturar qualquer chamada a endpoints de API inexistentes e retornar um JSON 404 padronizado.
- **Robustez nos Handlers:**
    - Adicionado tratamento de erro no parsing de JSON (`req.json()`) para retornar JSON 400 em vez de 500 HTML.
    - Implementados handlers explícitos para métodos não suportados (PUT, DELETE, PATCH, etc) retornando JSON 405.
    - Adicionado suporte a `OPTIONS` (CORS) em rotas críticas.
- **Rotas Atualizadas:**
    - `/api/mobile/device-link`
    - `/api/mobile/device-link/relink`
    - `/api/mobile/bootstrap`
    - `/api/mobile/equipment/lookup`

### 2. APK (Tratamento de Erros Resiliente)
- **Content-Type Check:** O `DeviceBindingRepositoryImpl` agora verifica o header `Content-Type`. Se for `text/html`, uma mensagem amigável é exibida: *"A Central retornou uma página HTML em vez de JSON. Verifique a URL da API ou o deploy do endpoint mobile."*
- **JSON Error Parsing:** Se a resposta for JSON, o app tenta extrair os campos `error` ou `message` antes de exibir o corpo bruto, garantindo mensagens limpas (ex: *"Token técnico inválido"*).

## Testes Executados
1. **GET inexistente:** `curl -i https://central.siloops.com.br/api/mobile/inexistente` -> Retorna JSON 404.
2. **POST malformado:** Envio de JSON inválido para `/api/mobile/device-link` -> Retorna JSON 400.
3. **Método errado:** `PUT` para `/api/mobile/device-link` -> Retorna JSON 405.
4. **Vínculo APK:** Validada a tentativa de vínculo com token inválido -> Exibe mensagem limpa "Token técnico inválido ou ausente".

## Resultado Final
O APK nunca mais exibirá `<!DOCTYPE html>` na tela. Mesmo em falhas graves de infraestrutura, a interface permanecerá profissional e amigável.
