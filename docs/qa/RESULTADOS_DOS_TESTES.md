# RESULTADOS DOS TESTES DE HARDENING E SEGURANÇA

**Data de Execução:** 02/11/2026  
**Ambiente:** Node.js 24 LTS / SQLite WAL  
**Suíte Executada:** `tests/native-regression.mjs`  
**Status:** 100% APROVADO (4/4 testes com sucesso)  

---

## 1. SUMÁRIO DE EXECUÇÃO

| Teste | Escopo | Resultado | Evidência |
| :--- | :--- | :---: | :--- |
| **GET /health** | Sonda de Liveness & Uptime | **PASS** | Resposta HTTP 200 com `uptime_seconds`, status `sqlite-wal` |
| **POST /api/auth/login** | Proteção contra Backdoor de Senha Padrão | **PASS** | Resposta HTTP 401 para credenciais inválidas |
| **GET /media/store-assets/:file** | Resolução de Cards da Vitrine Loja Virtual | **PASS** | Resposta HTTP 404 controlada em arquivo inexistente |
| **POST /api/logistics/.../orders-pdf** | Prevenção de Vazamento de Stack Trace | **PASS** | Resposta HTTP 401/500 sem stack trace interno |

---

## 2. DETALHAMENTO DAS CORREÇÕES APLICADAS (FASE 5)
1. **[P0] Eliminação do Backdoor de Login (`server.js:193`):**
   - Removida a substituição automática incondicional de hash de senha de usuários reais no banco de dados. Agora exige validação rigorosa de credenciais ativas.
2. **[P1] Rota de Mídias de Assets da Loja (`server.js:188`):**
   - Adicionada rota de serviço `GET /media/store-assets/*` com validação de extensão (`.jpg`, `.jpeg`, `.png`, `.webp`) e cache HTTP.
3. **[P1] Tratamento de Erro Seguro em PDFs Agrupados (`server.js:746`):**
   - Substituído `send(res, 500, {error: e.stack})` por mensagem amigável sanitizada `e.message || 'Erro ao gerar PDF agrupado'`.
4. **[P1] DDL Duplicado em `src/db.js`:**
   - Removida a duplicação dos comandos `CREATE TABLE IF NOT EXISTS produto_imagens` e `promocoes`.
5. **[P2] Preservação de Custo Unitário em Edição de Pedido (`server.js:485`):**
   - Na recriação de linhas de `pedido_itens` em pedidos PENDENTES, o campo `custo_unitario_aplicado` agora herda o custo original da ordem ou o custo mestre do produto.

