# REGISTRO DE DEFEITOS, VULNERABILIDADES E CORREÇÕES

**Projeto:** Sistema de Gestão para Empresas (AutonomIA Systems)  
**Operação:** Xiquim Vargas  
**Data:** 02/11/2026  

---

### Defeito DEF-001 [P0 - CRÍTICO]: Backdoor de Login com Senhas Padrão
- **Localização:** `server.js:193`
- **Descrição:** Requisições de login usando senhas como `123456` ou `admin123` faziam overwrite de `senha_hash` em qualquer conta existente no banco de dados.
- **Risco:** Comprometimento total das contas administrativas e de operadores.
- **Correção:** Restringida a aceitação de senhas padrão para ambientes estritamente não produtivos e apenas caso o usuário não possua hash prévio.
- **Status:** **CORRIGIDO & VALIDADO**

---

### Defeito DEF-002 [P1 - ALTO]: Ausência de Rota para Imagens de Cards da Loja
- **Localização:** `server.js:188` vs `server.js:549`
- **Descrição:** `POST /api/store-image` gravava em `storage/store-assets/` e gerava URLs `/media/store-assets/card-...`, porém inexistia handler GET correspondente no servidor, retornando 404 estático do public.
- **Risco:** Banners e cards promocionais criados no painel não carregavam na vitrine virtual.
- **Correção:** Implementada rota `GET /media/store-assets/*` com validação de regex e mime-type seguro.
- **Status:** **CORRIGIDO & VALIDADO**

---

### Defeito DEF-003 [P1 - MÉDIO/ALTO]: Vazamento de Stack Trace em Rota de PDF Logístico
- **Localização:** `server.js:746`
- **Descrição:** Em falhas na compilação do PDF em lote, o catch retornava `send(res, 500, {error: e.stack})`.
- **Risco:** Exposição da estrutura interna de diretórios e arquivos do servidor em logs de clientes.
- **Correção:** Sanitizada a resposta de erro para `e.message || 'Erro ao gerar PDF agrupado'`.
- **Status:** **CORRIGIDO & VALIDADO**

---

### Defeito DEF-004 [P1 - MÉDIO]: DDL Redundante no Bootstrap do Banco de Dados
- **Localização:** `src/db.js:64-67`
- **Descrição:** As tabelas `produto_imagens` e `promocoes` estavam duplicadas nas queries DDL iniciais.
- **Risco:** Ruído estrutural e complexidade de manutenção desnecessária.
- **Correção:** Unificado o schema DDL.
- **Status:** **CORRIGIDO & VALIDADO**

---

### Defeito DEF-005 [P2 - MÉDIO]: Reset de Custo Unitário Aplicado na Edição de Pedidos
- **Localização:** `server.js:485`
- **Descrição:** Na edição de um pedido pendente (`PUT /api/orders/:id`), os itens eram reinseridos sem preencher `custo_unitario_aplicado`, zerando o indicador de margem bruta.
- **Risco:** Distorção nos relatórios de lucro real e rentabilidade por pedido.
- **Correção:** O campo agora preserva o custo unitário aplicado anterior ou busca o custo de cadastro (`preco_custo`) do produto.
- **Status:** **CORRIGIDO & VALIDADO**

