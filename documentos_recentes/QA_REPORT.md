# Verificação do release 1.8.2

Data: 12/10/2026. Execução local isolada no Windows, com banco temporário e sem dados de produção.

## Resultados executados

- `npm run test:api`: 15 suítes e 59 testes passaram.
- `npm run stress:5000`: 5.000 requisições HTTP autenticadas concluídas com status 200; 1.000 por superfície (admin, vendedor, caixa, motorista e cliente web). As rotas de leitura foram alternadas entre os módulos de cada papel.
- `node --check`: servidor, app web, scripts de carga e arquivos JavaScript do cliente sem erros de sintaxe.
- Cenários automatizados incluem instalação com banco vazio, primeiro administrador, remoção da impersonação, tickets SSE, consolidação de linhas de pedido, preço por quantidade, conclusão de rota sem comprovante e upload de imagem de 6 MiB.
- Pacote de entrega conferido sem banco SQLite local, bootstrap, armazenamento, dependências instaladas, cobertura ou saídas de build.

## Limites

Os 5.000 acessos são uma varredura de leitura API local e não representam 5.000 gravações concorrentes, medições de latência de produção ou combinações exaustivas de todos os estados. Render, restauração de backup em produção, notificações reais e dispositivos Android físicos não foram exercitados nesta execução. Valores monetários continuam armazenados em colunas SQLite `REAL`; criação e edição de pedidos passaram a calcular os totais em centavos inteiros antes da gravação.
