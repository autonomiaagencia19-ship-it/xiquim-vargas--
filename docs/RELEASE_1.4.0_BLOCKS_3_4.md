# RELEASE 1.4.0 — BLOCO 3 + BLOCO 4

## Escopo

Esta release completa a segunda metade da fundação operacional prevista no RFC-XV-ERP-001 antes do Bloco 5.

## Implementações

### Bloco 3

- Perfil 360° de cliente.
- Resumo de pedidos, faturamento, valores em aberto e última compra.
- Produtos mais comprados com faturamento e última compra.
- Histórico navegável de pedidos.
- Endpoint de detalhe de pedido.
- Repeat-last preparado para reemissão/revisão.
- Preço contextual por `cliente_id`.
- CRUD administrativo de tabelas de preço.
- Edição de preços por produto.
- Desativação de tabela.
- PDF comercial refinado.

### Bloco 4

- Sidebar operacional organizada por domínio.
- Catálogo administrativo completo mantido na Torre.
- Histórico de estoque integrado ao catálogo.
- Perfil de cliente acessível na Torre.
- Perfil de cliente acessível ao vendedor dentro do escopo.
- Loja atualiza preços quando o cliente selecionado muda.
- Motorista pode anexar comprovante de entrega pela interface.
- Backend continua como autoridade para RBAC, preço, estoque e escopo.

## Referência externa

A implementação foi calibrada contra mecanismos recorrentes em ERPs de distribuição pesquisados em setembro de 2026: estoque em tempo real, pricing por cliente/volume, order management, portal B2B, fulfillment, analytics e governança.

Ver `docs/WEB_RESEARCH_ERP_DISTRIBUICAO_2026.md`.

## QA

Executado em banco limpo/reseed:

- `qa.mjs` — PASS
- `qa_block12.mjs` — PASS
- `qa_redteam.mjs` — PASS
- `qa_block34.mjs` — PASS

Não foi declarado como concluído o teste prolongado de 50 loops/10 minutos nesta rodada, porque o ambiente de execução utilizado possui limite de execução inferior. Nenhum resultado de teste prolongado foi simulado.
