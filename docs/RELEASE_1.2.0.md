# Xiquim Vargas ERP — Release 1.2.0

## Objetivo
Elevar o MVP para uma base operacional mais próxima de produto comercial, preservando SQLite e as interfaces existentes.

## Melhorias

- Headers HTTP de segurança e cache controlado.
- Tratamento global de exceções no servidor HTTP.
- Validação de entrada e limites de payload.
- JWT com comparação segura de assinatura e bloqueio de segredo padrão em produção.
- Paginação de catálogo e estoque.
- Índices adicionais SQLite.
- Limite de crédito transacional.
- Isolamento real de cliente web através de `usuario_clientes`.
- CRUD adicional para clientes, categorias, subcategorias e usuários.
- Histórico de movimentações de estoque.
- Proteção de comprovante por estado do pedido e tamanho do arquivo.
- Depósito de rota configurável.
- PDF com quebra de linhas e múltiplas páginas.
- Testes de concorrência, segurança e integridade.
- Benchmark funcional contra padrões de ERP de 2026.

## Validação

Foram executados 50 loops de hardening, cada loop cobrindo autenticação, RBAC, catálogo, estoque, pedido, preço server-side, máquina de estados, rota, comprovante, conclusão, PDF, auditoria e integridade SQLite.

O conjunto acumulou mais de 10 minutos de execução contínua através dos 50 ciclos, com espera deliberada entre ciclos para exercitar repetição operacional e persistência.
