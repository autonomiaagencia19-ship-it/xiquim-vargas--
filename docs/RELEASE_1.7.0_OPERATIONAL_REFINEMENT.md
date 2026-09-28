# Xiquim Vargas ERP 1.7.0 — Operational Refinement

## Objetivo

Esta release consolida uma separação operacional explícita entre **Catálogo** e **Estoque Inteligente**, completa o gerenciamento de mídia e promoções na Torre de Controle, melhora o carrinho da Loja Online, amplia a consulta de estoque do vendedor, endurece os PDFs e corrige a experiência de câmera do motorista.

## Mudanças principais

### 1. Catálogo independente do estoque
- `/api/products` não retorna `quantidade_disponivel`, `quantidade_reservada` ou `estoque_minimo`.
- A Torre de Controle não possui mais botões de estoque dentro do catálogo.
- Criar/editar produto não altera saldo de estoque.
- Produto novo nasce com estoque operacional zero; o lançamento ocorre exclusivamente no módulo Estoque Inteligente.

### 2. Estoque Inteligente independente
- `/api/stock` é a fonte operacional de saldo.
- Ajustes, entradas, saídas, inventário, mínimo e histórico ficam isolados.
- O painel usa linguagem visual próxima ao catálogo, mas fluxo/backend separado.
- Exportação completa para PDF.

### 3. Imagens de produtos
- Nova tabela `produto_imagens` com índice por produto.
- Metadados ficam no SQLite; binários ficam no filesystem em `storage/product-images/<produto>/<imagem>.<ext>`.
- Suporta milhares de imagens sem transformar o SQLite em um repositório de blobs.
- Upload pela UI; PNG/JPG/WEBP até 8 MB.
- Foto principal e múltiplas fotos.
- Exclusão pela UI.
- URLs públicas de mídia somente leitura e com cache imutável.

### 4. Promoções
- Nova tabela `promocoes`.
- Promoções possuem nome, preço promocional, início, término e ativo.
- Preço promocional é resolvido no backend para catálogo e pedidos.
- Estoque não é alterado por promoção.
- Nova seção administrativa de promoções.

### 5. Loja Online
- Campo de quantidade apenas seleciona a quantidade.
- `Adicionar` exclusivamente adiciona ao carrinho.
- Carrinho persistente durante a sessão.
- Remoção de itens.
- Total calculado antes do fechamento.
- Pedido somente nasce ao clicar em `Finalizar pedido`.
- Idempotency-Key protege contra duplo clique/reenvio.

### 6. Motorista
- Botão de canhoto usa `capture="environment"` para priorizar câmera traseira em dispositivos compatíveis.
- Backend continua validando tipo e tamanho da imagem.

### 7. Vendedor
- Novo painel `Estoque disponível`.
- Acesso somente leitura.
- Retorna apenas produto, SKU, descrição e quantidade existente.
- Nenhuma operação de ajuste é permitida ao vendedor.

### 8. PDFs
- Geradores de pedido, catálogo e estoque revisados.
- Paginação automática.
- Relatórios de catálogo e estoque em PDF.
- Downloads autenticados pelo frontend em vez de links desprotegidos.
- Teste de 120 linhas comprovou múltiplas páginas para os três documentos.

## Testes executados

- Syntax check Node.js: PASS.
- Feature QA: PASS.
- 50 ciclos: **50/50 PASS**.
- Red Team 1.7: PASS.
- PDF QA: PASS.
- `PRAGMA integrity_check`: PASS.
- `PRAGMA foreign_key_check`: PASS.
- Encoding runtime: sem sequências de mojibake detectadas.

## Limitação consciente

As imagens são armazenadas no filesystem e referenciadas pelo SQLite. Para instalações futuras em múltiplos servidores, o storage deve migrar para volume persistente compartilhado ou objeto compatível com S3. O contrato de banco não precisa mudar.

### 9. Painel da Loja Online
- Nova área `Torre de Controle → Loja Online`.
- Edita título, subtítulo, hero e rodapé da vitrine.
- A Loja Online consome essas configurações por `/api/store-config`.
- O conteúdo comercial permanece sem duplicação: produtos são gerenciados no Catálogo, fotos no gerenciador de fotos e campanhas em Promoções.
