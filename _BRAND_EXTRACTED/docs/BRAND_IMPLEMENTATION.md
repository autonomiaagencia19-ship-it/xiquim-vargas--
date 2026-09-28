# Xiquim Vargas — Implementação da Identidade Visual

## Base visual utilizada

A atualização das interfaces foi feita a partir das quatro referências visuais fornecidas na sessão:

- PDV / Frente de Loja
- Vendedor Externo
- Loja Online
- Torre de Controle

A tentativa de leitura automática do perfil do Instagram foi limitada pelo mecanismo de acesso da plataforma nesta sessão. Portanto, **não foram inventados elementos a partir do Instagram**: a implementação usa somente os elementos efetivamente visíveis nas referências fornecidas.

## Elementos de marca extraídos

Os recortes de logotipo ficam em `public/assets/brand/`:

- `logo-online.jpg` — símbolo circular X + Xiquim Vargas, com Vargas em laranja.
- `logo-pdv.jpg` — símbolo X branco + assinatura Frente de Loja.
- `logo-admin.jpg` — símbolo X laranja/cinza + assinatura ERP.

As referências originais permanecem em `docs/brand-reference/`.

## Linguagem visual consolidada

### Cores

- Navy principal: `#021D60`
- Laranja Xiquim: `#FD5E02`
- Fundo operacional escuro: `#07111D` / `#080E15`
- Branco: `#FFFFFF`
- Off-white: `#F7F9FC`
- Linhas claras: `#DFE5ED`
- Linhas escuras: `#233145`
- Verde operacional: `#22C55E`
- Âmbar: `#F59E0B`
- Vermelho: `#EF4444`

### Princípios

1. **Marca visível sem excesso:** logotipo real nos cabeçalhos, sem substituir a marca por texto genérico.
2. **Laranja para ação:** CTAs, preços, seleção ativa e pontos de atenção.
3. **Navy para confiança:** headers, navegação e loja online.
4. **Dark operacional:** Torre de Controle e PDV priorizam contraste e densidade de informação.
5. **Mobile limpo:** Vendedor e Motorista usam cards claros, grandes áreas de toque e hierarquia simples.
6. **Loja comercial:** hero navy, navegação horizontal, categorias em cards e catálogo visual.
7. **Estados preservados:** PENDENTE, SEPARACAO, ROTA e CONCLUIDO continuam visualmente distintos.

## Interfaces atualizadas

### Torre de Controle

- Sidebar permanente.
- Logo ERP oficial.
- Dashboards KPI.
- Kanban operacional.
- Botão de geração de rota em destaque.
- Navegação administrativa com estados ativos.

### PDV

- Layout em duas colunas inspirado diretamente na referência.
- Cabeçalho operacional escuro.
- Pesquisa de código/nome.
- Lista compacta de produtos.
- Pedido atual com controles de quantidade.
- Total destacado em laranja.
- Finalização em botão de alta visibilidade.

### Vendedor

- Cabeçalho navy.
- Carteira de clientes em cards.
- Ícones circulares laranja.
- Limite de crédito destacado.
- Novo pedido como CTA primário.
- Navegação inferior para operação com uma mão.

### Loja Online

- Cabeçalho comercial branco com marca.
- Hero navy.
- Categorias em cards.
- Produtos em grade.
- Preço laranja.
- CTAs consistentes.

### Motorista

- Interface escura e operacional.
- Fila do dia.
- Paradas numeradas.
- Endereço em destaque.
- Acesso direto ao Maps.
- Conclusão da entrega como ação primária.

## Compatibilidade

A atualização é exclusivamente de apresentação e composição das interfaces. O núcleo transacional SQLite, endpoints, autenticação, RBAC, emissão de PDF e fluxo de pedidos foram preservados.
