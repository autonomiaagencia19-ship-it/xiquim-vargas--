# Runbook — Xiquim Vargas ERP

## Instalação

1. Node.js 22+.
2. `cp .env.example .env`.
3. Defina `JWT_SECRET` forte em produção.
4. `npm run seed` apenas em instalação inicial/dados de demonstração.
5. `npm start`.

## Saúde

`GET /health` deve responder `ok: true`.

## QA

`npm run qa` executa o smoke test.

`npm run qa:50` executa o ciclo de 50 loops de hardening.

## Backup

Faça cópia consistente de `storage/xiquim-vargas.db` e do diretório `storage/pdfs`/`storage/proofs`. Não apague o único backup.

## Incidentes

### Estoque incorreto
1. interromper novas operações se necessário;
2. consultar movimentações;
3. conferir pedidos pendentes/rota;
4. corrigir via ajuste administrativo;
5. registrar observação.

### PDF ausente
O pedido permanece persistido. Regenerar por ferramenta administrativa apropriada; não recriar o pedido.

### IA indisponível
O ERP deve continuar operando. IA não participa do caminho transacional de venda.

### Mapa indisponível
O endereço permanece disponível no pedido; o motorista pode utilizar outro navegador de mapas.
