# Xiquim Vargas ERP — Release 1.3.0 Visual Identity

## Objetivo
Atualizar todas as interfaces do ERP para refletir de forma consistente a identidade visual observada nas referências fornecidas para Xiquim Vargas.

## Alterações

- Extração e incorporação dos logotipos visíveis nas referências.
- Novo sistema visual centralizado em `public/styles.css`.
- Torre de Controle refeita visualmente com sidebar, KPI cards e fluxo Kanban.
- PDV aproximado da referência de Frente de Loja: dark operational UI, pesquisa, lista compacta, pedido atual e CTA de finalização.
- Vendedor externo aproximado da referência mobile: header navy, carteira em cards, limite de crédito e navegação inferior.
- Loja Online aproximada da referência comercial: header, hero navy, categorias e grade de produtos.
- Motorista elevado para uma interface operacional escura, focada na fila do dia e execução de paradas.
- Assets de marca isolados em `public/assets/brand`.
- Referências originais preservadas em `docs/brand-reference`.

## Integridade funcional

Não foram alterados os contratos centrais de autenticação, RBAC, SQLite, pedidos, estoque, PDF, logística ou estados do pedido nesta rodada. As alterações de servidor restringem-se à publicação segura dos assets de marca.

## Verificações

- `node --check server.js` — PASS
- `node --check public/app.js` — PASS
- `node --check public/role.js` — PASS
- `/health` — PASS
- `/admin.html` — PASS
- `/loja.html` — PASS
- `/vendedor.html` — PASS
- `/pdv.html` — PASS
- `/motorista.html` — PASS
- `/assets/brand/logo-online.jpg` — PASS
- `/assets/brand/logo-pdv.jpg` — PASS
- `/assets/brand/logo-admin.jpg` — PASS
- login administrativo com credencial seed documentada — PASS

## Nota sobre Instagram

A URL do perfil Instagram fornecida foi consultada, mas o acesso automático retornou bloqueio/throttling da plataforma. Para evitar inventar elementos de marca, a implementação desta release usa exclusivamente os quatro materiais visuais fornecidos na conversa.
