# AUTONOMIA SYSTEMS — CATÁLOGO COMPLETO DE API REST E STREAMING
**Referência Exaustiva de Endpoints, Contratos REST, Eventos em Tempo Real e RBAC**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Base URL Oficial:** https://xiquim-vargas-erp.onrender.com  
**Data de Homologação:** Outubro de 2026

---

## 1. PADRÕES TÉCNICOS DA API, SEGURANÇA E PROTOCOLOS
A API do ERP AutonomIA opera sob o padrão arquitetural RESTful com barramento de eventos em tempo real:
* **Base URL de Produção:** `https://xiquim-vargas-erp.onrender.com`
* **Formato de Dados:** `application/json; charset=utf-8`
* **Mecanismo de Autenticação:** Cabeçalho HTTP padrão `Authorization: Bearer <TOKEN_JWT>`.
* **Idempotência em Operações Críticas:** Cabeçalho opcional `Idempotency-Key: <UUID>` aceito em rotas de upload de comprovantes e mutações de pedidos para evitar duplicidades em oscilações de sinal.
* **Rastreabilidade de Requisições:** Cada chamada gera ou propaga o cabeçalho `x-request-id` (`cryptoRandomId`), indexado na tabela `system_events`.
* **Controle de Vazão (Rate Limiting):**
  - Autenticação (`POST /api/auth/login`): máximo de 20 tentativas por minuto por IP.
  - Endpoints gerais da API: máximo de 600 requisições por minuto por IP.
  - Endpoints isentos de limitação: health check (`/health`, `/ready`), assets estáticos e streaming SSE (`/api/events`).
* **Códigos de Resposta HTTP Padronizados:**
  - `200 OK`: Operação ou consulta executada com sucesso.
  - `201 Created`: Entidade criada no banco de dados.
  - `400 Bad Request`: Parâmetros ausentes, payload inválido ou violação de esquema.
  - `401 Unauthorized`: Ausência de token JWT ou sessão expirada/inválida.
  - `403 Forbidden`: Operador autenticado sem permissão de acesso para o recurso solicitado.
  - `404 Not Found`: Registro não encontrado no banco de dados.
  - `409 Conflict`: Conflito transacional (estoque insuficiente, duplicidade de chave, violação de estado).
  - `413 Payload Too Large`: Upload excede o tamanho máximo permitido (ex: imagem > 8MB).
  - `429 Too Many Requests`: Limite de taxa excedido.

---

## 2. INVENTÁRIO EXAUSTIVO DE ENDPOINTS POR MÓDULO

### 2.1 Saúde, Monitoramento e Infraestrutura
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Público | Retorna status de saúde operacional: `{ ok, service, version, time, uptime_seconds, database, pid }`. |
| `GET` | `/ready` | Público | Readiness probe do Render: `{ ok: true, ready: true, version: "1.8.2" }`. |

### 2.2 Streaming de Eventos em Tempo Real (SSE)
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/events/ticket` | Autenticado | Gera ticket temporário criptográfico de mão única com validade de 30s para conexão SSE: `{ ticket: "base64url" }`. |
| `GET` | `/api/events?ticket=...` | Autenticado | Abre fluxo Server-Sent Events contínuo. Envia ping a cada 25s e filtra eventos por perfil do usuário. |

### 2.3 Inicialização e Autenticação
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/setup/status` | Público | Retorna se o setup do primeiro administrador é necessário: `{ required, initialized, version }`. |
| `POST` | `/api/setup/initialize` | Setup Token | Cria o primeiro administrador da instalação (consumindo código de setup único). |
| `POST` | `/api/auth/login` | Público | Autenticação com e-mail e senha: `{ email, password }`. Retorna `{ token, user }`. |
| `GET` | `/api/me` | Autenticado | Retorna dados do usuário autenticado no token atual (`id, nome, email, role, telefone`). |

### 2.4 Dashboards e Indicadores Comerciais
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/dashboard` | Admin | Métricas executivas: total de vendas, faturamento diário, pedidos por status, estoque crítico. |
| `GET` | `/api/dashboard/product-sales`| Admin | Curva ABC de vendas por produto em período selecionado. |
| `GET` | `/api/seller/dashboard/monthly`| Seller, Admin | Metas mensais do vendedor logado, volume faturado e percentual de atingimento. |
| `GET` | `/api/crm/dashboard` | Seller, Admin | Indicadores de carteira de clientes: clientes ativos, inativos e ticket médio. |

### 2.5 Catálogo de Produtos, Imagens e Promoções
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/products` | Todos | Lista produtos ativos com preços, categorias, subcategorias e fotos. Suporta filtro `?q=...`. |
| `POST` | `/api/products` | Admin | Cadastro de novo produto: `{ nome, sku, preco_base, preco_custo, categoria_id, ... }`. |
| `PUT` | `/api/products/:id` | Admin | Atualização cadastral de produto existente e recálculo de preço de custo. |
| `POST` | `/api/products/:id/sold-out` | Admin | Alterna indicador de esgotado (`esgotado = 1/0`). |
| `DELETE`| `/api/products/:id` | Admin | Exclusão lógica do produto (`ativo = 0`). |
| `POST` | `/api/products/:id/images` | Admin | Upload de foto do produto em base64/dataURL. Salva em disco em `/product-images/:pid/`. |
| `GET` | `/api/products/:id/images` | Admin | Lista todas as imagens associadas ao produto e marca a principal. |
| `DELETE`| `/api/product-images/:id` | Admin | Remove uma foto específica do catálogo do produto. |
| `POST` | `/api/products/:id/promotions`| Admin | Cadastra preço promocional com data de início e término. |
| `GET` | `/api/promotions` | Autenticado | Lista todas as promoções vigentes no catálogo. |
| `DELETE`| `/api/promotions/:id` | Admin | Encerra ou remove uma promoção ativa. |
| `GET` | `/api/products/:id/costs-history`| Admin | Histórico auditado de variações de preço de custo do produto. |

### 2.6 Categorias e Subcategorias
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/categories` | Todos | Lista categorias ativas e contagem de itens. |
| `POST` | `/api/categories` | Admin | Cria nova categoria comercial. |
| `PUT` | `/api/categories/:id` | Admin | Edita nome e descrição de categoria. |
| `DELETE`| `/api/categories/:id` | Admin | Desativa categoria. |
| `POST` | `/api/subcategories` | Admin | Cadastra subcategoria vinculada a uma categoria pai. |
| `PUT` | `/api/subcategories/:id`| Admin | Edita subcategoria existente. |
| `DELETE`| `/api/subcategories/:id`| Admin | Desativa subcategoria. |

### 2.7 Estoque, Movimentações e Código de Barras
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stock` | Admin, Cashier | Lista geral de estoque com saldos disponível, reservado e status (OK, ATENCAO, CRITICO, SEM_ESTOQUE). |
| `GET` | `/api/seller/stock` | Seller, Admin | Consulta simplificada de estoque disponível para vendedores externos. |
| `POST` | `/api/stock/:pid` | Admin | Ajuste manual de saldo físico com registro compulsório de motivo. |
| `GET` | `/api/stock/:pid/movements`| Admin, Seller, Cashier | Extrato de movimentações de estoque (`movimentacoes_estoque`) do SKU. |
| `GET` | `/api/pdv/barcode?code=...`| Admin, Cashier | Busca instantânea de item no PDV pelo leitor de código de barras ou SKU. |
| `GET` | `/api/inbound/barcode?code=...`| Admin | Busca e validação de item na doca de recebimento. |
| `GET` | `/api/inbound/summary` | Admin | Resumo consolidado de compras pendentes de entrada física. |

### 2.8 Clientes, CRM e Interações Comerciais
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/clients` | Admin, Seller, Cashier | Lista clientes da carteira do operador com filtros por bairro e nome. |
| `POST` | `/api/clients` | Admin, Seller | Cadastra novo cliente com validação de CNPJ/CPF e endereço de entrega. |
| `PUT` | `/api/clients/:id` | Admin, Seller | Atualiza dados cadastrais e vínculos comerciais. |
| `GET` | `/api/clients/:id/profile` | Admin, Seller, WebClient | Perfil comercial consolidado: histórico de pedidos, ticket médio e tabela de preço. |
| `POST` | `/api/clients/:id/repeat-last`| Admin, Seller, WebClient | Clona o último pedido faturado do cliente para emissão ágil de recompra. |
| `GET` | `/api/clients/:id/interactions`| Admin, Seller | Linha do tempo de atendimentos, visitas e contatos registrados no CRM. |
| `POST` | `/api/clients/:id/interactions`| Admin, Seller | Adiciona nova interação de atendimento no prontuário do cliente. |
| `POST` | `/api/admin/client-links` | Admin | Gera links de autoatendimento vinculados ao cliente corporativo. |

### 2.9 Tabelas de Preço e Descontos por Volume
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/price-tables` | Admin, Seller, Cashier | Lista tabelas de preço ativas cadastradas no sistema. |
| `POST` | `/api/price-tables` | Admin | Cria nova tabela de preços (ex: Atacado, Varejo, Promocional). |
| `PUT` | `/api/price-tables/:id` | Admin | Edita nome e parâmetros da tabela de preço. |
| `POST` | `/api/price-tables/apply` | Admin | Aplicação em massa de percentual de reajuste (acréscimo ou desconto). |
| `GET` | `/api/price-tables/:id/items`| Admin, Seller, Cashier | Lista itens com preços diferenciados e quantidade mínima estipulada. |
| `GET` | `/api/price-tables/:id/details`| Admin, Seller, Cashier | Detalhes consolidados da tabela e clientes vinculados. |
| `DELETE`| `/api/price-tables/:id/clients/:cid`| Admin | Desvincula cliente específico da tabela. |
| `DELETE`| `/api/price-tables/:id/clients`| Admin | Remove todos os clientes vinculados à tabela. |
| `DELETE`| `/api/price-tables/:id/groups/:g`| Admin | Desvincula grupo de clientes (ex: web, atacado). |
| `DELETE`| `/api/price-tables/:id` | Admin | Exclui tabela de preço (se desvinculada). |

### 2.10 Gestão de Pedidos e Faturamento
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/orders` | Admin, Seller, Cashier, Driver | Lista pedidos com filtros por status (`PENDENTE`, `SEPARACAO`, `ROTA`, `CONCLUIDO`). |
| `POST` | `/api/orders` | Admin, Seller, Cashier, WebClient | Emissão de novo pedido com reserva atômica de estoque e geração de PDF. |
| `PUT` | `/api/orders/:id` | Admin, Seller, Cashier | Edição de pedido em status `PENDENTE` (ajuste de itens ou quantidades). |
| `POST` | `/api/orders/:id/cancel` | Admin | Cancelamento formal de pedido com estorno imediato do estoque reservado. |
| `GET` | `/api/orders/cancelled` | Admin | Consulta de histórico de pedidos cancelados com operador e justificativa. |
| `POST` | `/api/orders/:id/status` | Admin, Cashier | Avanço manual de status do pedido na esteira operacional. |
| `POST` | `/api/orders/:id/toggle-payment`| Admin, Cashier | Alterna o status financeiro entre `RECEBIDO` e `NAO_RECEBIDO`. |
| `GET` | `/api/orders/:id/detail` | Todos (Scoped) | Detalhamento completo do pedido, itens, tributação e rota. |
| `GET` | `/api/orders/:id/pdf` | Todos (Scoped) | Download do documento PDF vetorial do pedido (`XV-AAAA-XXXXXX.pdf`). |

### 2.11 Logística, Roteirização e Entregas
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/logistics/route-config` | Admin | Lista rotas configuradas por dia da semana e bairros atendidos. |
| `POST` | `/api/logistics/route-config` | Admin | Cadastra nova rota no cronograma semanal de logística. |
| `PUT` | `/api/logistics/route-config/:id`| Admin | Edita nome, dia da semana e bairros da rota. |
| `POST` | `/api/logistics/route-assignments`| Admin | Atribui vendedor responsável pela rota de atendimento. |
| `DELETE`| `/api/logistics/route-assignments/:v/:d`| Admin | Desvincula vendedor de rota específica. |
| `GET` | `/api/logistics/grouped-orders`| Admin | Agrupa pedidos prontos por bairros para formação de rotas. |
| `POST` | `/api/logistics/loading-list` | Admin | Gera lista consolidada de separação e carregamento para os estoquistas. |
| `POST` | `/api/logistics/loading-list/pdf`| Admin | Emite documento PDF da lista de separação e romaneio de carga. |
| `POST` | `/api/logistics/loading-list/orders-pdf`| Admin | Gera PDF unificado de todos os pedidos selecionados na carga. |
| `POST` | `/api/logistics/routes` | Admin | Cria nova rota física, despacha para veículo e avança pedidos para `ROTA`. |
| `GET` | `/api/logistics/routes` | Admin, Driver | Lista rotas ativas do dia associadas ao motorista logado. |
| `GET` | `/api/logistics/completed-routes`| Admin, Driver | Histórico de rotas concluídas e índices de eficiência de entrega. |
| `POST` | `/api/logistics/orders/:oid/complete`| Driver, Admin | Conclusão de entrega pelo motorista com baixa final de estoque. |
| `POST` | `/api/logistics/orders/complete-direct`| Admin | Baixa expressa direta em lote pela Torre (sem vínculo com motorista). |
| `POST` | `/api/logistics/orders/:oid/fail`| Driver, Admin | **Protocolo de Insucesso:** reverte pedido de `ROTA` para `SEPARACAO` e emite alerta. |
| `GET` | `/api/logistics/returned-orders`| Admin, Driver | Lista de pedidos retornados para conferência física e reagendamento. |
| `POST` | `/api/logistics/orders/:oid/proof`| Driver, Admin | Anexa comprovante fotográfico de entrega (canhoto ou assinatura). |
| `GET` | `/api/logistics/delivery-routes-config`| Todos | Consulta taxas de entrega e dias de atendimento por bairro. |
| `POST` | `/api/logistics/delivery-routes-config`| Admin | Parametrização de taxas e prazos de frete por bairro. |

### 2.12 Fornecedores, Compras e Doca Inbound
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/suppliers` | Admin | Lista os 15 fornecedores homologados com CNPJ, contato e condições comerciais. |
| `POST` | `/api/suppliers` | Admin | Cadastro de novo fornecedor de produtos ou matéria-prima. |
| `GET` | `/api/suppliers/:id` | Admin | Ficha completa do fornecedor e histórico de fornecimento. |
| `PUT` | `/api/suppliers/:id` | Admin | Atualização cadastral do fornecedor. |
| `DELETE`| `/api/suppliers/:id` | Admin | Desativação de fornecedor. |
| `GET` | `/api/suppliers/:id/products`| Admin | Consulta de produtos homologados para compra junto ao fornecedor. |
| `POST` | `/api/suppliers/:id/products`| Admin | Vincula SKU ao catálogo do fornecedor com código de referência. |
| `DELETE`| `/api/suppliers/:id/products/:pid`| Admin | Desvincula produto do catálogo do fornecedor. |
| `GET` | `/api/products/:pid/suppliers`| Admin | Lista fornecedores homologados para um SKU específico. |
| `GET` | `/api/purchases` | Admin | Lista ordens de compra emitidas com filtros de status (`SOLICITADO`, `RECEBIDO`). |
| `POST` | `/api/purchases` | Admin | Emissão de nova ordem de compra de mercadorias. |
| `GET` | `/api/purchases/:id` | Admin | Consulta espelho da ordem de compra e itens faturados. |
| `POST` | `/api/purchases/:id/status`| Admin | Atualiza status da compra (`CONFIRMADO`, etc.). |
| `POST` | `/api/purchases/:id/cancel` | Admin | Cancelamento de ordem de compra pendente. |
| `POST` | `/api/purchases/:id/receive`| Admin | Recebimento na doca: incrementa estoque físico e atualiza custo médio. |

### 2.13 Loja Online e Autoatendimento (B2B/B2C)
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/store/availability` | WebClient | Checagem de disponibilidade de múltiplos produtos no carrinho. |
| `POST` | `/api/store/register` | Público | Auto-cadastro de novos clientes na Loja Online com criação de acesso. |
| `GET` | `/api/store/profile` | WebClient | Consulta de dados cadastrais e endereços do cliente online. |
| `PUT` | `/api/store/profile` | WebClient | Atualização de perfil e telefone pelo cliente online. |
| `GET` | `/api/store-config` | Público | Consulta configurações institucionais da loja (banners, horários, pedido mínimo). |
| `POST` | `/api/store-cover` | Admin | Upload de nova imagem de capa/hero para o e-commerce. |
| `DELETE`| `/api/store-cover` | Admin | Restauração da capa institucional padrão. |
| `POST` | `/api/store-image` | Admin | Upload de imagens promocionais para a loja online. |

### 2.14 Governança, Usuários, Auditoria e IA
| Método | Endpoint | Perfil (RBAC) | Descrição e Contrato |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/audit` | Admin | Log de auditoria transacional completo (`audit_logs`) com filtros por usuário e ação. |
| `GET` | `/api/admin/access-links` | Admin | Consulta de links de primeiro acesso e recuperação de senha de operadores. |
| `GET` | `/api/users` | Admin | Lista os colaboradores cadastrados com perfil funcional e status ativo/inativo. |
| `POST` | `/api/users` | Admin | Cadastra novo colaborador no sistema com perfil (`admin`, `seller`, `cashier`, `driver`). |
| `PUT` | `/api/users/:id` | Admin | Edita dados, cargo ou redefine senha de operador. |
| `DELETE`| `/api/users/:id` | Admin | Desativa acesso de colaborador ao sistema. |
| `GET` | `/api/settings` | Admin | Consulta parâmetros e configurações operacionais (`configuracoes`). |
| `POST` | `/api/settings` | Admin | Grava ou atualiza chave de configuração do sistema. |
| `GET` | `/api/reports` | Admin | Relatórios analíticos consolidados de vendas, margem e giro. |
| `GET` | `/api/admin/profit-report` | Admin | Relatório de lucratividade por produto, vendedor e canal. |
| `GET` | `/api/admin/metrics` | Admin | Métricas de telemetria do Node.js: requisições, erros, uptime. |
| `GET` | `/api/admin/reconcile` | Admin | Auditoria de conciliação entre estoque físico e histórico de movimentações. |
| `POST` | `/api/admin/rebuild-pdfs` | Admin | Regeneração em lote de PDFs de pedidos do histórico. |
| `GET` | `/api/admin/ia/status` | Admin | Status da integração com IA Groq (`openai/gpt-oss-120b`). |
| `POST` | `/api/admin/ia` | Admin | Consulta em linguagem natural para assistência gerencial via IA. |
