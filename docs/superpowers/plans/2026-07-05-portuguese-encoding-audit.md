# Auditoria forense de encoding pt-BR na Central

**Data:** 2026-07-05  
**Escopo:** source local, `.next`, renderização de produção

## Resumo executivo

A hipótese de “cache apenas” caiu. Encontrei mojibake real no source local, em bytes, nos arquivos abaixo:

- `app/combustivel/produtos/page.tsx`
- `app/combustivel/comboios/page.tsx`
- `app/fazendas-talhoes/page.tsx`

Isso prova que o problema existe antes do browser.

## Evidência objetiva

### Source local

Arquivos com encoding contaminado:

1. `app/combustivel/produtos/page.tsx`
   - `const COLUMNS = ['CÃ³digo', ...]`
   - `label: 'CÃ³digo'`
   - `tipo: 'CombustÃ­vel'`

2. `app/combustivel/comboios/page.tsx`
   - `const COLUMNS = ['CÃ³digo', 'DescriÃ§Ã£o', ... 'AÃ§Ãµes']`
   - `subtitle="Cadastro de unidades abastecedoras (caminhÃ£o-pipa, ... )"`
   - `label: 'CÃ³digo'`

3. `app/fazendas-talhoes/page.tsx`
   - `FormField label="CÃ³digo"`
   - `FormField label="CÃ³digo do TalhÃ£o"`

### `.next` buildado

O build foi gerado a partir do source contaminado. Os chunks compilados carregam os mesmos literais de texto como strings escapadas. Exemplo:

- `app/combustivel/produtos/page-*.js`
- `app/combustivel/comboios/page-*.js`

Conclusão prática: o build não limpa encoding por milagre. Ele herda o conteúdo textual do source.

### Produção / navegador

Nesta sessão eu não consegui confirmar visualmente a página autenticada em produção porque a rota redirecionou para login no teste HTTP local. Então:

- confirmação direta no browser: pendente
- causa provável: source/build contaminados, não cache de navegador

## Matriz final

| Camada | Status |
|---|---|
| Source local | Não limpo |
| Source VPS | Não verificado diretamente nesta sessão |
| `.next` buildado | Contaminado pelo source |
| Navegador em produção | Não confirmado nesta sessão |

## Causa provável

O problema está na origem textual dos arquivos, com double-encoding já presente no repositório. Se a VPS estiver rodando esse mesmo commit ou um build derivado dele, o erro aparece em produção sem qualquer “culpa” especial do browser.

## Próximo passo recomendado

Corrigir os textos do source em UTF-8 real, rebuildar, limpar cache de deploy/CDN e validar de novo em sessão autenticada.
