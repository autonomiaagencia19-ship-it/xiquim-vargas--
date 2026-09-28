# RFC-XV-ERP-001 — PLANO DEFINITIVO
## Xiquim Vargas ERP — Evolução do MVP para Produto Operacional Profissional

**Status:** ACTIVE / LIVING RFC  
**Versão:** 1.0.0  
**Data:** 27/09/2026  
**Base:** XiquimVargasERPV1.3.0 + auditoria técnica existente + plano mestre anterior + HTML-base original + scripts QA/red-team presentes no repositório.  
**Banco:** SQLite permanece como decisão arquitetural. PostgreSQL não faz parte deste RFC.  
**Princípio:** completar, endurecer e polir o que já existe; não reescrever o sistema sem necessidade comprovada.

---

# 0. OBJETIVO DO RFC

Este RFC substitui o plano anterior como documento operacional único para a evolução do Xiquim Vargas ERP.

O sistema deve sair de um MVP funcional para uma aplicação comercial robusta, previsível, segura, auditável, rápida e de manutenção próxima de zero.

A implementação deve preservar:

- SQLite;
- WAL;
- foreign keys;
- transações ACID;
- máquina de estados Lean com PENDENTE → SEPARACAO → ROTA → CONCLUIDO;
- identidade visual Xiquim Vargas;
- interfaces separadas por função;
- aplicativos nativos Android para vendedor e motorista;
- PDFs armazenados;
- auditoria;
- RBAC;
- arquitetura Ring 0–3 como separação lógica de responsabilidades.

Não é objetivo deste RFC criar complexidade artificial, dezenas de estados, microserviços prematuros ou dependências desnecessárias.

---

# 1. PRINCÍPIOS DE ENGENHARIA

## 1.1 Fonte de verdade

O código, o banco e os testes devem convergir para o comportamento documentado neste RFC.

Uma funcionalidade só será considerada **DONE** quando existir:

1. persistência correta;
2. API ou serviço correspondente;
3. autorização;
4. UI correspondente quando aplicável;
5. tratamento de erro;
6. auditoria quando houver alteração operacional;
7. teste positivo;
8. teste negativo;
9. teste de concorrência quando houver estado transacional;
10. documentação de operação quando necessário.

## 1.2 SQLite

SQLite permanece o banco oficial da aplicação.

Regras:

- WAL habilitado;
- foreign_keys habilitado;
- busy_timeout habilitado;
- operações transacionais críticas usando `BEGIN IMMEDIATE`;
- índices nas colunas de pesquisa e relacionamento;
- nenhuma operação crítica deve depender de leitura → cálculo → escrita fora da transação quando houver risco de corrida;
- estoque nunca pode ficar negativo;
- reserva e liberação devem ser atomicamente consistentes.

## 1.3 Simplicidade operacional

O sistema deve preferir:

`menos estados + regras determinísticas + boa auditoria`

em vez de:

`mais estados + mais filas + mais eventos + mais pontos de falha`.

## 1.4 Segurança por default

Toda rota deve começar negada e liberar somente os papéis necessários.

Nunca confiar em:

- role enviada pelo frontend;
- ID informado pelo cliente;
- existência de token sem validação de usuário ativo;
- URL de arquivo;
- quantidade calculada pelo frontend;
- preço enviado pelo frontend.

O backend é a autoridade.

---

# 2. ARQUITETURA DEFINITIVA EM CINCO BLOCOS

```text
┌──────────────────────────────────────────────────────────┐
│ BLOCO 1 — FUNDAÇÃO, SEGURANÇA E RESILIÊNCIA             │
├──────────────────────────────────────────────────────────┤
│ BLOCO 2 — CATÁLOGO, ESTOQUE E GOVERNANÇA DE PRODUTO     │
├──────────────────────────────────────────────────────────┤
│ BLOCO 3 — CLIENTES, PEDIDOS, PREÇOS E DOCUMENTOS        │
├──────────────────────────────────────────────────────────┤
│ BLOCO 4 — INTERFACES OPERACIONAIS E EXPERIÊNCIA          │
├──────────────────────────────────────────────────────────┤
│ BLOCO 5 — LOGÍSTICA, IA, OBSERVABILIDADE E HARDENING     │
└──────────────────────────────────────────────────────────┘
```

---

# BLOCO 1 — FUNDAÇÃO, SEGURANÇA E RESILIÊNCIA

## 1.1 Objetivo

Transformar a base atual em uma fundação previsível e resistente a erros operacionais, sessão inválida, manipulação de dados, concorrência e falhas de execução.

## 1.2 Ring 0

Responsabilidades:

- autenticação;
- assinatura e validação JWT;
- expiração;
- usuário ativo;
- correspondência role/token/banco;
- RBAC;
- rate limit de login;
- headers de segurança;
- limites de payload;
- isolamento de arquivos;
- IDs de requisição;
- tratamento centralizado de erros;
- auditoria das ações administrativas sensíveis.

## 1.3 Autenticação

JWT continua sendo usado.

Regra adicional obrigatória: um token válido criptograficamente não deve continuar autorizando um usuário que foi desativado ou cuja role foi alterada.

A cada autorização protegida:

```text
JWT
 ↓
assinatura válida?
 ↓
expiração válida?
 ↓
usuário existe?
 ↓
usuário ativo?
 ↓
role do banco == role do token?
 ↓
rota permite a role?
 ↓
EXECUTA
```

## 1.4 RBAC

Papéis oficiais:

- `admin` — Torre de Controle;
- `seller` — vendedor externo;
- `cashier` — frente de loja;
- `driver` — motorista;
- `web_client` — cliente da loja online.

O backend deve controlar cada endpoint individualmente.

## 1.5 Segurança de armazenamento

Arquivos em `/storage` nunca são públicos.

PDF:

- somente usuário autorizado;
- vendedor somente seus pedidos/cliente permitido;
- cliente somente seus documentos;
- motorista somente documentos relacionados às suas rotas;
- admin global.

Comprovantes seguem a mesma regra.

## 1.6 Resiliência

O servidor deve:

- não cair por exceção de uma requisição;
- devolver JSON de erro previsível;
- gerar `x-request-id`;
- impedir payload excessivo;
- limpar buckets de rate limit antigos;
- impedir path traversal;
- impedir acesso a arquivos fora do storage permitido.

## 1.7 Critério de conclusão do Bloco 1

- login correto;
- login inválido limitado;
- token expirado rejeitado;
- usuário desativado rejeitado;
- role alterada invalidando token antigo;
- acesso cruzado rejeitado;
- payload grande rejeitado;
- path traversal rejeitado;
- SQLite integrity check OK;
- foreign key check OK;
- testes automatizados verdes.

---

# BLOCO 2 — CATÁLOGO, ESTOQUE E GOVERNANÇA DE PRODUTO

## 2.1 Objetivo

Transformar o catálogo e o estoque no núcleo operacional de produtos da distribuidora.

## 2.2 Estrutura

```text
Categoria
 └── Subcategoria
      └── Produto
           ├── SKU
           ├── código de barras
           ├── marca
           ├── sabor
           ├── tamanho
           ├── unidade
           ├── descrição
           ├── imagem
           ├── preço base
           └── estoque
```

## 2.3 Torre de Controle

A Torre deve possuir controle completo sobre:

- categorias;
- subcategorias;
- produtos;
- marca;
- sabor;
- tamanho;
- unidade;
- SKU;
- código de barras;
- descrição;
- foto;
- preço base;
- ativo/inativo;
- estoque mínimo;
- saldo disponível;
- reservado;
- movimentações.

## 2.4 Dashboard Catálogo

A interface deve permitir:

- pesquisa por nome;
- pesquisa por SKU;
- pesquisa por código de barras;
- filtro por categoria;
- filtro por subcategoria;
- criação;
- edição;
- ativação/desativação;
- visualização de saldo;
- abertura do histórico de estoque.

## 2.5 Estoque Inteligente

Campos:

- `quantidade_disponivel`;
- `quantidade_reservada`;
- `estoque_minimo`;
- `updated_at`.

Status calculado:

```text
SEM_ESTOQUE
CRITICO
ATENCAO
OK
```

## 2.6 Movimentações

Toda alteração manual deve gerar:

- produto;
- tipo;
- delta;
- saldo anterior;
- saldo posterior;
- operador;
- observação;
- data/hora.

Tipos mínimos:

- ENTRADA;
- SAIDA;
- AJUSTE;
- INVENTARIO;
- ENTRADA_INICIAL;
- RESERVA.

## 2.7 Reserva transacional

Pedido criado:

```text
BEGIN IMMEDIATE
 ↓
validar produto
 ↓
validar quantidade
 ↓
validar estoque
 ↓
calcular preço pelo backend
 ↓
validar crédito
 ↓
criar pedido
 ↓
criar itens
 ↓
abater disponível
 ↓
incrementar reservado
 ↓
registrar movimentação
 ↓
COMMIT
```

Qualquer falha:

```text
ROLLBACK TOTAL
```

## 2.8 Governança de categoria

Uma subcategoria somente pode pertencer à categoria correta.

O produto não pode apontar para uma subcategoria de outra categoria.

## 2.9 Critério de conclusão do Bloco 2

- CRUD de categoria;
- CRUD de subcategoria;
- CRUD completo de produto;
- filtros;
- pesquisa;
- estoque;
- histórico;
- auditoria;
- validação de preço;
- validação de quantidade;
- prevenção de estoque negativo;
- prevenção de subcategoria incompatível;
- concorrência testada.

---

# BLOCO 3 — CLIENTES, PEDIDOS, PREÇOS E DOCUMENTOS

## 3.1 Clientes

Perfil completo:

- razão social;
- nome fantasia;
- CNPJ/CPF;
- contato;
- endereço;
- coordenadas;
- limite de crédito;
- tabela de preço;
- vendedor responsável;
- histórico de pedidos;
- PDFs;
- produtos mais comprados.

## 3.2 Carteira do vendedor

O vendedor somente acessa clientes atribuídos a ele.

## 3.3 Tabelas de preço

O preço efetivo deve ser calculado no servidor:

```text
cliente
 ↓
tabela_preco
 ↓
produto
 ↓
preço aplicado
```

O frontend nunca tem autoridade para definir o preço final.

## 3.4 Pedido

Origens:

- `WEB` → Loja Online;
- `VENDEDOR` → Vendedor Externo;
- `BALCAO` → Frente de Loja.

Estados:

```text
PENDENTE
   ↓
SEPARACAO
   ↓
ROTA
   ↓
CONCLUIDO
```

## 3.5 PDFs

Cada pedido deve possuir documento persistido.

O PDF definitivo deverá conter:

- marca;
- número;
- data/hora;
- origem;
- cliente;
- documento;
- operador;
- itens;
- quantidade;
- preço unitário;
- subtotal;
- total;
- observações;
- identificação da empresa;
- paginação.

## 3.6 Histórico

Perfil do cliente:

```text
Pedidos
 ├── Vendedor Externo
 ├── Loja Online
 └── Frente de Loja
```

Cada item deve possuir acesso ao PDF.

## 3.7 Produtos mais comprados

Derivação a partir dos itens dos pedidos concluídos, sem armazenamento redundante desnecessário.

---

# BLOCO 4 — INTERFACES OPERACIONAIS E EXPERIÊNCIA

## 4.1 Torre de Controle

Sidebar permanente com dashboards:

- Visão Geral;
- Pedidos;
- Catálogo;
- Estoque Inteligente;
- Clientes;
- Logística;
- Vendedores e Usuários;
- Tabelas de Preço;
- Relatórios;
- Auditoria;
- Configurações;
- IA Administrativa.

A Torre deve ser a interface de supervisão e edição global.

## 4.2 Loja Online

Deve possuir:

- catálogo;
- categorias;
- pesquisa;
- preço conforme tabela;
- carrinho;
- checkout;
- Meu Perfil;
- histórico;
- PDFs;
- repetir pedido.

## 4.3 Vendedor Externo

Aplicação nativa Android.

Deve priorizar velocidade:

- login;
- carteira;
- cliente;
- limite;
- catálogo;
- pesquisa;
- carrinho;
- pedido;
- histórico próprio;
- PDF.

## 4.4 PDV

Interface desktop otimizada para teclado:

- busca rápida;
- código de barras;
- quantidade;
- carrinho;
- cliente;
- fechamento;
- PDF;
- atalhos;
- feedback visual imediato.

## 4.5 Motorista

Aplicação nativa Android.

Fluxo:

```text
Fila do Dia
 ↓
Parada
 ↓
Endereço
 ↓
Mapa
 ↓
Entrega
 ↓
Foto do comprovante
 ↓
Concluído
```

---

# BLOCO 5 — LOGÍSTICA, IA, OBSERVABILIDADE E HARDENING

## 5.1 Logística

Pedidos em `SEPARACAO` podem entrar no planejamento.

A Torre seleciona:

- pedidos;
- motorista;
- data.

## 5.2 Roteamento

Primeira camada:

- Nearest Neighbor determinístico;
- origem no depósito;
- pedidos com coordenadas;
- pedidos sem coordenadas tratados separadamente.

Evolução:

- distância real;
- tempo estimado;
- restrições de veículo;
- janela operacional;
- comparação entre rotas.

## 5.3 Motorista

A rota criada muda os pedidos para `ROTA` atomicamente.

O motorista somente enxerga suas próprias rotas.

## 5.4 IA

A IA deve permanecer fora do caminho crítico.

Modelo:

```text
Banco
 ↓ somente leitura
Contexto determinístico
 ↓
LLM
 ↓
Resposta
```

A IA administrativa não pode alterar diretamente:

- estoque;
- pedido;
- preço;
- usuário;
- rota.

Ações futuras deverão passar por comandos explícitos e autorizados.

## 5.5 Observabilidade

Adicionar:

- request ID;
- logs estruturados;
- eventos de erro;
- métricas de latência;
- health check;
- integridade SQLite;
- espaço de storage;
- falhas de PDF;
- falhas de rota.

## 5.6 Red Team

Testes mínimos:

- RBAC;
- IDOR;
- path traversal;
- payload excessivo;
- preço negativo;
- quantidade negativa;
- estoque negativo;
- crédito excedido;
- SKU duplicado;
- concorrência;
- replay de transação;
- usuário desativado;
- role alterada;
- acesso cruzado de PDFs;
- acesso cruzado de comprovantes;
- SQL injection nos filtros;
- XSS no catálogo;
- upload inválido;
- arquivo grande;
- rota duplicada;
- conclusão duplicada.

## 5.7 QA de produção

Os 50 loops não serão somente repetições do mesmo teste.

Cada loop deve combinar:

1. smoke;
2. funcional;
3. segurança;
4. concorrência;
5. persistência;
6. recuperação;
7. UI/API;
8. integridade.

---

# 3. ORDEM DE EXECUÇÃO

## Fase A — Blocos 1 e 2

Executar imediatamente.

Resultado esperado:

- fundação endurecida;
- encoding corrigido;
- sessão segura;
- catálogo completamente administrável;
- estoque auditável;
- testes dos fluxos críticos.

## Fase B — Bloco 3

Depois da estabilidade dos Blocos 1 e 2.

## Fase C — Bloco 4

Depois de estabilizar APIs e regras de negócio.

## Fase D — Bloco 5

Depois de o núcleo estar funcional.

---

# 4. DEFINITION OF DONE GLOBAL

O Xiquim Vargas ERP somente poderá ser classificado como RELEASE OPERACIONAL quando:

- todas as rotas críticas possuírem autorização;
- todas as operações transacionais críticas forem atomicamente seguras;
- nenhuma tela apresentar encoding corrompido;
- catálogo for administrável pela Torre;
- estoque possuir histórico;
- pedidos possuírem PDF válido;
- cliente possuir histórico e documentos;
- vendedor possuir isolamento de carteira;
- PDV possuir fluxo completo;
- motorista possuir fluxo completo e comprovante;
- logística possuir rota determinística testada;
- IA não puder modificar estado diretamente;
- red-team estiver verde;
- QA estiver verde;
- SQLite integrity check estiver verde;
- foreign key check estiver verde;
- documentação estiver sincronizada com código.

---

# 5. REGRA DE EVOLUÇÃO

Não adicionar complexidade sem uma falha ou requisito que a justifique.

Não criar um novo serviço porque o nome "microserviço" parece mais profissional.

Não trocar SQLite apenas por escala hipotética.

Não trocar vanilla JS apenas por preferência tecnológica.

Não criar estados de pedido que não tenham consequência operacional real.

O objetivo é:

> **Máxima confiabilidade com a menor superfície operacional possível.**

---

# 6. ESTADO DESTA VERSÃO

## Bloco 1

**EXECUTADO nesta rodada:**

- correção de encoding nos arquivos afetados;
- validação de usuário ativo e role atual na autorização;
- limpeza do rate-limit de login;
- request ID;
- limite de payload corrigido;
- reforço das validações do catálogo/estoque.

## Bloco 2

**EXECUTADO nesta rodada:**

- CRUD administrativo mais completo do catálogo;
- filtros por categoria/subcategoria;
- edição completa dos principais atributos do produto;
- criação de categoria;
- edição de categoria;
- criação de subcategoria;
- histórico de estoque na Torre;
- registro de entrada inicial de estoque;
- validação de compatibilidade categoria/subcategoria;
- validação forte de quantidade e estoque mínimo;
- tipos de movimentação controlados.

## Próximo estado

Os Blocos 1 e 2 passam agora para validação automatizada e manual antes de iniciar o Bloco 3.

---

# 3. BLOCO 3 — CLIENTES, PEDIDOS, PREÇOS E DOCUMENTOS — EXECUTADO / REFINADO

## 3.1 Objetivo

Fazer do cliente e do pedido objetos completos do ERP, eliminando a situação em que o sistema conhece a transação mas não oferece contexto operacional suficiente para atendimento, repetição de compra e auditoria.

## 3.2 Perfil 360° do cliente

O perfil agora consolida:

- dados cadastrais;
- vendedor responsável;
- tabela de preço;
- limite de crédito;
- quantidade de pedidos;
- faturamento concluído;
- valor de pedidos em aberto;
- última compra;
- produtos mais comprados;
- faturamento por produto;
- data da última compra por produto;
- histórico de pedidos;
- acesso ao PDF de cada pedido;
- navegação para detalhe do pedido;
- mecanismo de repetição do último pedido.

A regra permanece server-side: o frontend não decide quais clientes um vendedor pode enxergar.

## 3.3 Pedido como objeto operacional

Foi adicionado endpoint de detalhe:

`GET /api/orders/:id/detail`

O retorno reúne:

- cabeçalho do pedido;
- cliente;
- operador;
- origem;
- status;
- itens;
- SKU;
- código de barras;
- quantidade;
- preço unitário aplicado;
- subtotal;
- comprovantes de entrega disponíveis.

A autorização continua baseada em `visibleOrder()`.

## 3.4 Preço por cliente

A API de catálogo aceita `cliente_id` e devolve `preco_aplicado`.

Isso permite que vendedor e loja online utilizem o mesmo mecanismo de precificação sem duplicar regra no frontend.

A Torre agora possui:

- criação de tabela;
- visualização;
- edição de preços por produto;
- ativação/desativação;
- auditoria;
- consulta dos itens de uma tabela.

## 3.5 PDF

O emissor foi refinado para uma estrutura documental mais profissional:

- marca Xiquim Vargas;
- identificação do pedido;
- data/hora;
- cliente;
- documento;
- origem;
- status;
- tabela de itens;
- quantidade;
- preço unitário;
- subtotal;
- total;
- identificação do ERP.

O gerador permanece deliberadamente sem dependência externa pesada.

## 3.6 Testes executados

`qa_block34.mjs` validou:

- perfil 360°;
- resumo financeiro do cliente;
- produtos mais comprados;
- `repeat-last`;
- preço aplicado por cliente;
- criação de tabela;
- edição de preço;
- consulta de itens;
- desativação de tabela;
- detalhe de pedido;
- isolamento por vendedor.

Resultado:

`BLOCK 3/4 PASS`

---

# 4. BLOCO 4 — INTERFACES OPERACIONAIS E EXPERIÊNCIA — EXECUTADO / REFINADO

## 4.1 Princípio

A interface não deve conter regra comercial crítica. Ela coleta intenção e apresenta estado; o backend calcula preço, verifica estoque, valida escopo e grava a transação.

## 4.2 Torre de Controle

A sidebar foi mantida como navegação operacional explícita e organizada em:

### Operação

- Visão Geral;
- Pedidos;
- Catálogo;
- Estoque Inteligente;
- Clientes.

### Gestão

- Logística;
- Vendedores e Usuários;
- Tabelas de preço;
- Relatórios.

### Governança

- Auditoria;
- Configurações;
- IA Administrativa.

Cada botão abre seu dashboard funcional sem exigir que o operador conheça rotas internas.

## 4.3 Catálogo da Torre

A Torre continua podendo editar:

- produto;
- categoria;
- subcategoria;
- SKU;
- código de barras;
- marca;
- sabor;
- tamanho;
- unidade;
- descrição;
- preço base;
- foto;
- classificação.

Também pode abrir diretamente o histórico de estoque de cada produto.

## 4.4 Estoque Inteligente

O operador administrativo pode:

- pesquisar;
- visualizar disponível;
- visualizar reservado;
- visualizar estoque mínimo;
- ajustar saldo;
- registrar tipo de movimentação;
- registrar observação;
- consultar histórico.

## 4.5 Vendedor

O vendedor recebe preço contextual do cliente, em vez de depender exclusivamente do preço-base do produto.

A carteira ganhou acesso direto ao perfil do cliente e ao histórico operacional.

## 4.6 Motorista

A interface passou a expor o mecanismo de comprovante de entrega:

1. motorista abre a parada;
2. acessa o endereço;
3. fotografa/seleciona o canhoto;
4. envia o comprovante;
5. o servidor valida tipo e tamanho;
6. o arquivo é armazenado no storage protegido;
7. o registro fica vinculado ao pedido e ao motorista;
8. a entrega pode ser concluída.

## 4.7 Loja Online

A loja passa a atualizar o catálogo quando o cliente selecionado muda, permitindo que `preco_aplicado` seja refletido no canal online.

O princípio é o mesmo das referências modernas de distribuição: o preço é contextual ao comprador e não uma cópia estática do catálogo público.

## 4.8 Segurança de UX

A UI não é considerada fronteira de segurança.

Mesmo que um operador altere HTML, JavaScript ou payload manualmente:

- RBAC continua no backend;
- cliente continua validado no backend;
- origem continua vinculada à role;
- preço é resolvido no servidor;
- estoque é reservado em transação;
- documentos são protegidos no storage.

## 4.9 Testes

Foram executados:

- `node --check` em backend e frontend;
- QA geral;
- Block 1/2;
- red-team;
- Block 3/4.

Resultados:

- `QA PASS`;
- `BLOCK 1/2 PASS`;
- `RED TEAM PASS`;
- `BLOCK 3/4 PASS`.

---

# 5. DECISÕES DE ENGENHARIA ABSORVIDAS DA PESQUISA DE MERCADO

A pesquisa de 2026 sobre ERPs de distribuição foi usada como **benchmark de mecanismos**, não como ordem de implementação.

As capacidades recorrentes encontradas foram:

1. estoque em tempo real;
2. preço específico por cliente e volume;
3. order management;
4. B2B self-service;
5. integração multicanal;
6. warehouse/fulfillment;
7. replenishment/demand planning;
8. analytics operacional;
9. integração logística;
10. governança e auditoria.

O Xiquim Vargas absorve progressivamente esses mecanismos sem importar a complexidade enterprise que não é necessária ao seu modelo operacional.

Referência detalhada: `docs/WEB_RESEARCH_ERP_DISTRIBUICAO_2026.md`.

---

# 6. STATUS DO RFC APÓS ESTA RODADA

| Bloco | Estado |
|---|---|
| 1 — Fundação, Segurança e Resiliência | EXECUTADO |
| 2 — Catálogo, Estoque e Governança | EXECUTADO |
| 3 — Clientes, Pedidos, Preços e Documentos | EXECUTADO / REFINADO |
| 4 — Interfaces Operacionais e Experiência | EXECUTADO / REFINADO |
| 5 — Logística, IA, Observabilidade e Hardening | PENDENTE |

O sistema não deve ser declarado produto comercial definitivo enquanto o Bloco 5 não estiver concluído e os testes finais de produção não forem aprovados.

---

# 7. BLOCO 5 — EXECUÇÃO FINAL E HARDENING 1.5.0

O Bloco 5 foi executado com foco em confiabilidade operacional, recuperação e acabamento final.

## 7.1 Resiliência transacional

- SQLite permanece em WAL.
- `busy_timeout` permanece habilitado.
- transações de escrita continuam concentradas no menor trecho crítico possível.
- criação de pedidos ganhou `Idempotency-Key` para impedir duplicação causada por retry/duplo clique.
- conclusão de entrega usa atualização condicional de estado.
- saída de estoque é registrada no ledger ao concluir a venda.
- reservas podem ser comparadas contra pedidos ainda ativos.

## 7.2 Observabilidade

Foram adicionados:

- `x-request-id`;
- métricas administrativas;
- eventos operacionais;
- contagem de respostas por status;
- contador de erros;
- último erro observado;
- endpoint `/health`;
- endpoint `/ready`;
- tratamento de erro com `request_id`.

## 7.3 Auditoria

A auditoria recebeu cadeia SHA-256 entre eventos consecutivos. O objetivo é tornar alterações acidentais ou manipulações posteriores detectáveis.

A implementação não pretende substituir um SIEM; ela fornece uma camada local de integridade e rastreabilidade compatível com a escala do ERP.

## 7.4 Documentos

O PDF passou a ter estado operacional:

- `PENDING`;
- `READY`;
- `ERROR`.

Um PDF ausente pode ser reconstruído sob demanda e existe uma operação administrativa para reconstrução em lote.

## 7.5 Backup

Foi criado `scripts/backup.mjs`, usando `VACUUM INTO` e posterior `PRAGMA integrity_check`.

O backup não deve ser tratado como substituto de uma política externa de retenção. Para produção, recomenda-se copiar os backups para outro dispositivo/local.

## 7.6 Estoque

Foi criado `/api/admin/reconcile`, que compara `quantidade_reservada` com a quantidade dos itens pertencentes a pedidos não concluídos.

Essa reconciliação deve ser executada diariamente ou após qualquer incidente de energia/processo.

## 7.7 UX e frontend

A camada final de CSS acrescenta:

- foco visível;
- navegação responsiva;
- redução de movimento;
- hierarquia visual;
- estados de hover;
- scrollbar operacional;
- formulários mais consistentes;
- tabelas mais legíveis;
- melhor comportamento móvel;
- tratamento de estados vazios e carregamento.

O arquivo de backup antigo do frontend com encoding corrompido foi removido do runtime distribuído.

## 7.8 Segurança nativa

Os aplicativos Android nativos continuam Kotlin puro, sem Expo Go. Credenciais de demonstração não ficam mais preenchidas no formulário nativo.

A compilação dos APKs depende do Android SDK/Gradle do ambiente de desenvolvimento.

## 7.9 Correção descoberta nos ciclos

Durante o red-team final foi encontrada uma referência SQL incorreta no fechamento automático da rota. O erro foi corrigido e o red-team foi executado novamente com resultado PASS.

## 7.10 50 ciclos finais

`qa_50_cycles_final.mjs` foi executado em banco limpo e concluiu:

**FINAL 50 CYCLES PASS: 50/50**

O relatório detalhado está em `docs/FINAL_50_CYCLES_REPORT.md`.

Execuções adicionais de endurance com intervalos de 8–10 segundos foram iniciadas, mas excederam o limite de wall-clock do ambiente de execução. Elas não são contabilizadas como ciclos concluídos.

---

# 8. DEFINITION OF DONE — V1.5.0

A versão 1.5.0 é considerada tecnicamente preparada para a próxima etapa de homologação quando:

- [x] backend sem erro de sintaxe;
- [x] frontend sem encoding conhecido corrompido;
- [x] SQLite íntegro;
- [x] foreign keys íntegras;
- [x] estoque não negativo;
- [x] RBAC testado;
- [x] red-team executado;
- [x] idempotência de pedido implementada;
- [x] reconciliação implementada;
- [x] backup consistente implementado;
- [x] PDF recuperável;
- [x] observabilidade básica implementada;
- [x] 50 ciclos finais PASS;
- [x] interface refinada;
- [x] apps nativos sem credenciais embutidas.

Ainda requer homologação operacional humana antes de uso comercial: impressora/leitor de código de barras reais, política de backup externa, credenciais de produção, domínio/HTTPS, dispositivos Android reais e validação do fluxo logístico físico.
