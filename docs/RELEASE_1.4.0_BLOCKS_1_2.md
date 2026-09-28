# Xiquim Vargas ERP — Release 1.4.0
## Blocos 1 e 2 do Plano Definitivo RFC

### Escopo

Esta release executa os dois primeiros blocos do `docs/PLANO_DEFINITIVO_RFC.md`.

### Fundação / Ring 0

- Corrigido encoding corrompido encontrado em `server.js` e `public/app.js`.
- Autorização agora confirma usuário ativo e correspondência entre role do token e role atual do banco.
- Rate-limit de login recebe limpeza automática de buckets antigos.
- Requests recebem `x-request-id`.
- Limite de payload passa a reportar corretamente 2 MB.
- Mantidos headers de segurança existentes.
- Origem do pedido agora é validada contra o perfil do operador:
  - seller → `VENDEDOR`;
  - cashier → `BALCAO`;
  - web_client → `WEB`.
- Admin permanece capaz de operar os fluxos administrativos permitidos.

### Catálogo

A Torre de Controle ganhou uma experiência de catálogo mais completa:

- pesquisa;
- filtro por categoria;
- filtro por subcategoria;
- criação de produto;
- edição completa dos principais campos;
- criação de categoria;
- edição de categoria;
- criação de subcategoria;
- visão resumida da estrutura do catálogo;
- indicação explícita de que a Torre possui edição administrativa.

### Estoque

- cadastro inicial gera movimentação `ENTRADA_INICIAL`;
- estoque mínimo validado;
- delta validado;
- tipo de movimentação validado;
- histórico de movimentações acessível pela Torre;
- categoria/subcategoria de produto são validadas no backend;
- estoque negativo continua bloqueado;
- movimentação continua transacional e auditada.

### QA executado

- `node --check server.js` — PASS
- `node --check public/app.js` — PASS
- `scripts/qa_block12.mjs` — PASS
- `scripts/qa.mjs` — PASS
- `scripts/qa_redteam.mjs` — PASS

O script de 50 loops existente também revelou uma necessidade de melhoria no próprio harness: ele realizava leituras SQLite diretas repetidamente enquanto o servidor estava operacional. O teste foi ajustado para utilizar a API durante os loops e reservar a leitura direta do SQLite para a validação final, reduzindo interferência entre conexões.

### Banco

SQLite permanece inalterado como decisão arquitetural.

Mantidos:

- WAL;
- foreign keys;
- busy timeout;
- `BEGIN IMMEDIATE` para transações críticas.

### Próximo bloco

O próximo trabalho previsto pelo RFC é o Bloco 3: clientes, histórico, preços, pedidos e documentos comerciais.
