# WEB RESEARCH — ERP PARA DISTRIBUIÇÃO / ATACADO — 2026

**Data:** 27/09/2026  
**Uso:** referência de engenharia para os Blocos 3 e 4 do RFC-XV-ERP-001.

## 1. Síntese

A pesquisa de referências de ERP para atacado/distribuição confirma que os mecanismos que mais se repetem nos produtos maduros não são telas isoladas, mas a conexão entre **estoque em tempo real, preços por cliente/volume, processamento de pedidos, operação de armazém, portal B2B, vendas multicanal e analytics**.

Fontes pesquisadas:

- ERP Research — comparação Dynamics 365 x SAP Business One para distribuição.
- ERP Implementation — requisitos de ERP B2B/atacado.
- Kissinger Associates — capacidades críticas para distribuidores.
- ERP Pilot — pricing, WMS, replenishment, EDI e rebate management.
- Orcabs — comparação prática de plataformas para atacado/distribuição.

## 2. Mecanismos absorvidos pelo Xiquim Vargas ERP

### 2.1 Preço contextual

Referências de distribuição destacam preços específicos por cliente, contratos e faixas de volume. O Xiquim Vargas já possui `tabelas_preco` e `tabela_preco_itens`; nos Blocos 3/4 o preço aplicado passou a ser explicitamente exposto pela API como `preco_aplicado`, mantendo o servidor como autoridade.

### 2.2 Visibilidade operacional do estoque

ERPs de distribuição maduros tratam visibilidade de estoque como mecanismo operacional, não como simples cadastro. O Xiquim Vargas mantém estoque disponível, reservado, mínimo e histórico de movimentação; o frontend passou a tratar o histórico como parte do produto e da governança da Torre.

### 2.3 Pedido como objeto central

A pesquisa recorrente aponta order management como elo entre vendas, estoque, fulfillment e atendimento. O Bloco 3 transforma o pedido em objeto navegável: detalhe, itens, origem, operador, cliente, status, documento PDF e histórico.

### 2.4 Portal/autosserviço B2B

Referências de ERP B2B destacam self-service e histórico de pedidos. O Xiquim Vargas mantém a separação entre loja online e demais canais e amplia o perfil do cliente, histórico e repetição do último pedido.

### 2.5 Operação multicanal

A arquitetura original do Xiquim Vargas diferencia WEB, VENDEDOR e BALCAO. O servidor continua sendo a única autoridade para preço, estoque e criação do pedido, evitando divergência entre canais.

### 2.6 Warehouse / fulfillment

As referências destacam pick-pack-ship, acuracidade e eficiência de armazém. O Xiquim Vargas preserva a máquina lean de quatro estados e usa `SEPARACAO` como fronteira operacional antes da rota, evitando uma explosão de estados.

### 2.7 Analytics operacional

Relatórios de produtos, clientes, vendedores e origem de vendas aparecem como capacidade recorrente. O perfil do cliente agora consolida pedidos, faturamento, aberto e produtos mais comprados.

## 3. O que NÃO foi copiado

Não foram adicionados:

- microserviços;
- dezenas de estados de pedido;
- EDI prematuro;
- multiempresa;
- multiestoque fictício;
- WMS avançado sem necessidade operacional;
- IA autorizada a alterar dados críticos sem confirmação;
- dependências pesadas somente para reproduzir features de suites enterprise.

A referência de mercado serve para identificar mecanismos, não para copiar complexidade.

## 4. Fontes

- ERP Research, “Microsoft Dynamics 365 vs SAP Business One for Wholesale & Distribution”, 2026.
- ERP Implementation, “ERP for Wholesale & Trade: Essential Features”, 2026.
- Kissinger Associates, “Best ERP for Wholesale Distributors”, 2026.
- ERP Pilot, “Best ERP for Wholesale and Distribution”, 2026.
- Orcabs, “Best ERP Software for Wholesale and Distribution”, 2026.
