import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('xiquimvargasmanuais');

export const doc06 = `# AUTONOMIA SYSTEMS — MATRIZ DE ACESSOS E RESPONSABILIDADES
**Governança de Perfis, Controle Granular de Permissões (RBAC) e Matriz RACI**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Data:** Outubro de 2026

---

## 1. MAPEAMENTO DE PERFIS E APLICATIVOS DEDICADOS
O sistema adota o modelo de Controle de Acesso Baseado em Papéis (RBAC - Role-Based Access Control) estritamente integrado aos 4 aplicativos nativos e interfaces web. Cada colaborador atua sob um perfil delimitado, sem interferência em dados fora de sua alçada operacional:

| Perfil Operacional (\`role\`) | Interface Web Dedicada | Aplicativo Android Nativo Dedicado | Escopo e Responsabilidades Principais |
| :--- | :--- | :--- | :--- |
| **Administrador (\`admin\`)** | \`/admin.html\` | \`XiquimVargas-TorreControle-1.8.3.apk\` | Gestão executiva irrestrita, auditoria, precificação, liberação de rotas, compras, usuários e IA. |
| **Vendedor Externo (\`seller\`)** | \`/vendedor.html\` | \`XiquimVargas-Vendedor-1.8.3.apk\` | Emissão de pedidos em campo, catálogo, metas do mês, clientes da carteira e outbox offline. |
| **Operador de Caixa (\`cashier\`)** | \`/pdv.html\` | \`XiquimVargas-PDV-1.8.3.apk\` *(ou Caixa)* | Venda expressa de balcão, bipagem de código de barras, múltiplos pagamentos e impressão térmica. |
| **Motorista (\`driver\`)** | \`/motorista.html\` | \`XiquimVargas-Motorista-1.8.3.apk\` | Fila de paradas do dia, contato direto WhatsApp/fone, registro de comprovantes e insucessos. |
| **Expedidor / Estoquista** | \`/admin.html\` (Logística) | \`XiquimVargas-TorreControle-1.8.3.apk\` | Separação física de mercadorias, conferência de romaneio, carregamento e conferência de doca. |
| **Cliente Web (\`web_client\`)** | \`/loja.html\` | Navegador Mobile / PWA | Autoatendimento para consulta de catálogo, compras digitais e acompanhamento de entregas. |

### 1.1 Como Funciona Cada Perfil Operacional (Role) no Dia a Dia

#### A. Perfil Administrador (\`admin\`)
* **Propósito:** É a autoridade executiva e supervisora global do sistema.
* **Acesso & Interface:** Acessa a Torre de Controle via \`admin.html\` ou pelo APK \`XiquimVargas-TorreControle-1.8.3.apk\`.
* **Como Opera:**
  - Gerencia o catálogo mestre de produtos, criação de categorias, subcategorias e uploads de fotos.
  - Define políticas de precificação, margens e tabelas de preço por canal ou volume.
  - Acompanha o Kanban de pedidos em tempo real via Server-Sent Events (SSE).
  - Supervisiona a expedição, monta rotas logísticas e atribui motoristas às cargas do dia.
  - Realiza compras de fornecedores (inbound) e confere entradas físicas na doca.
  - Monitora o painel de pedidos retornados (insucessos logísticos) e decide sobre reembarque.
  - Possui exclusividade para cancelamento de pedidos com estorno automático de estoque.
  - Consulta logs de auditoria transacional (\`audit_logs\`) e interage com o assistente Groq AI.

#### B. Perfil Vendedor Externo (\`seller\`)
* **Propósito:** Força de vendas em campo (representantes comerciais e televendas).
* **Acesso & Interface:** Opera pelo aplicativo nativo \`XiquimVargas-Vendedor-1.8.3.apk\` ou \`vendedor.html\`.
* **Como Opera:**
  - Visualiza exclusivamente os clientes vinculados à sua carteira comercial.
  - Consulta o catálogo completo com fotos, descrições e estoque disponível em tempo real.
  - Aplica automaticamente as tabelas de preço associadas ao cliente selecionado.
  - Emite novos pedidos diretamente no cliente. Caso esteja em área rural ou sem sinal, o pedido é salvo na outbox local em IndexedDB (\`xv-offline-v1-...\`) e sincronizado automaticamente assim que a conexão retornar.
  - Acompanha suas metas comerciais do mês e o volume faturado em dashboard privativo.

#### C. Perfil Operador de Caixa / Frente de Loja (\`cashier\`)
* **Propósito:** Atendimento presencial ágil no balcão e faturamento de loja física.
* **Acesso & Interface:** Terminal PDV em \`pdv.html\` ou aplicativo nativo \`XiquimVargas-PDV-1.8.3.apk\` (também distribuído como \`XiquimVargas-Caixa-1.8.3.apk\`).
* **Como Opera:**
  - Opera com foco em velocidade de atendimento, bipando códigos de barras diretamente via leitor óptico.
  - Utiliza o cliente padrão pré-cadastrado \`CLIENTE-BALCAO\` (Consumidor Final) para dispensar cadastros morosos em vendas de balcão.
  - Seleciona múltiplos meios de pagamento: Dinheiro (com cálculo automático de troco em tela), Débito, Crédito (à vista ou parcelado de 2x a 12x) e PIX.
  - Dispara a impressão de cupons térmicos diretamente para mini-impressoras térmicas conectadas.
  - Funciona 100% offline em contingência caso haja oscilação no link de internet da loja.

#### D. Perfil Motorista / Entregador (\`driver\`)
* **Propósito:** Distribuição física, transporte e entrega de mercadorias aos clientes.
* **Acesso & Interface:** Aplicativo nativo móvel \`XiquimVargas-Motorista-1.8.3.apk\` ou \`motorista.html\`.
* **Como Opera:**
  - Visualiza apenas as rotas e paradas atribuídas a ele pela expedição no dia vigente.
  - Acessa botões de discagem rápida e WhatsApp em 1 clique para alinhar o recebimento com o cliente antes de estacionar.
  - Ao realizar a entrega, fotografa o comprovante/canhoto assinado via câmera do app e conclui a parada, baixando o estoque reservado definitivamente.
  - Em caso de cliente ausente, recusa ou estabelecimento fechado, aciona o botão **"Registrar Retorno"**, informando o motivo. O pedido reverte automaticamente para o status \`SEPARACAO\` e alerta a Torre de Controle sem travar o restante da rota.

#### E. Perfil Expedidor / Estoquista (Operação de Galpão)
* **Propósito:** Separação física de itens no depósito, conferência de romaneios e carregamento.
* **Acesso & Interface:** Módulo de Logística e Estoque na Torre de Controle (\`admin.html\`).
* **Como Opera:**
  - Imprime as listas de separação consolidadas (PDF de Romaneio de Carga).
  - Retira as caixas e fardos no depósito físico e realiza a conferência na doca de expedição.
  - Carrega os veículos conforme a ordem viária definida no sistema.
  - Realiza a conferência de entrada física de compras de fornecedores (inbound).

#### F. Perfil Cliente Web (\`web_client\`)
* **Propósito:** Autoatendimento digital para clientes finais e pessoas jurídicas (B2B/B2C).
* **Acesso & Interface:** Loja Online E-Commerce em \`loja.html\` acessível via navegador desktop ou celular.
* **Como Opera:**
  - Navega pelo catálogo dinâmico de produtos com busca inteligente e filtros por categoria.
  - Adiciona itens ao carrinho com validação instantânea de disponibilidade de estoque.
  - O sistema calcula automaticamente o frete de entrega baseado no bairro de destino do cliente.
  - Valida o valor mínimo de compra parametrizado pela empresa antes do fechamento.
  - Acompanha o status de evolução do seu pedido (Pendente -> Separação -> Em Rota -> Entregue).

---

## 2. MATRIZ DE PERMISSÕES POR RECURSO DA API
A tabela abaixo define os privilégios de acesso aos módulos do sistema:

| Módulo / Recurso do Sistema | Admin | Vendedor | Caixa (PDV) | Motorista | Cliente Web |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Consulta de Catálogo de Produtos** | Total | Total | Total | Visual | Total |
| **Cadastro e Edição de Produtos/Preços**| Total | Não | Não | Não | Não |
| **Ajuste Manual de Estoque** | Total | Não | Não | Não | Não |
| **Emissão de Pedidos** | Total | Carteira | Balcão | Não | Próprios |
| **Cancelamento de Pedidos** | Total | Não | Não | Não | Não |
| **Frente de Caixa (PDV) e Baixa Balcão**| Total | Não | Total | Não | Não |
| **Criação e Despacho de Rotas** | Total | Não | Não | Não | Não |
| **Visualização de Rotas Atribuídas** | Total | Não | Não | Próprias | Não |
| **Baixa de Entrega e Upload de Canhoto**| Total | Não | Não | Próprias | Não |
| **Registro de Insucesso (Devolução)** | Total | Não | Não | Próprias | Não |
| **Doca de Compras e Recebimento** | Total | Não | Não | Não | Não |
| **Auditoria e Histórico de Transações** | Total | Não | Não | Não | Não |
| **Gestão de Usuários e Acessos** | Total | Não | Não | Não | Não |
| **Assistente Executivo de IA Groq** | Total | Não | Não | Não | Não |

---

## 3. MATRIZ RACI DAS OPERAÇÕES EMPRESARIAIS
Convenção: **R** = Responsável pela execução; **A** = Aprovador final; **C** = Consultado; **I** = Informado.

| Processo Operacional | Direção / Admin | Vendedor | Caixa | Motorista | Expedição | Cliente |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Parametrização de Preços e Margens** | **R / A** | I | I | I | I | I |
| **2. Cadastro e Homologação de SKUs** | **R / A** | I | I | I | I | I |
| **3. Prospecção e Cadastro de Clientes** | A | **R** | I | I | I | C |
| **4. Emissão de Pedido Externo** | I | **R / A** | I | I | I | C |
| **5. Compra via Loja Online** | I | I | I | I | I | **R / A** |
| **6. Venda Balcão no PDV** | I | I | **R / A** | I | I | C |
| **7. Separação Física no Depósito** | I | I | I | I | **R / A** | I |
| **8. Montagem e Otimização de Rotas** | A | I | I | C | **R** | I |
| **9. Transporte e Entrega ao Destino** | I | I | I | **R** | A | C |
| **10. Registro de Insucesso / Retorno** | I | I | I | **R** | **A** | I |
| **11. Recebimento de Compras na Doca** | A | I | I | I | **R** | I |
| **12. Fechamento de Caixa Diário** | A | I | **R** | I | I | I |
| **13. Execução e Validação de Backups** | **R / A** | I | I | I | I | I |
`;

export const doc07 = `# AUTONOMIA SYSTEMS — RELATÓRIO DE VALIDAÇÃO DE FLUXOS
**Evidências de Qualidade, Suítes Automatizadas, Homologação Mobile e Integridade**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs:** v1.8.3 | **Data:** Outubro de 2026

---

## 1. SUMÁRIO EXECUTIVO DE HOMOLOGAÇÃO
Este relatório atesta a aprovação técnica e operacional integral do ecossistema ERP AutonomIA, validando a conformidade dos módulos web, banco de dados, barramento em tempo real e os 4 aplicativos nativos Android:

* **19 Suítes de Testes Automatizados da API (101 testes):** 100% de taxa de sucesso com tempo de execução médio de 2.1 segundos.
* **Testes End-to-End (E2E) com Cypress:** 4 suítes de validação de fluxo de tela (\`login.cy.js\`, \`delivery_routes_cronograma.cy.js\`, \`price_tables.cy.js\`, \`users.cy.js\`) homologadas.
* **Benchmark de Estresse e Concorrência:** 5.000 requisições autenticadas executadas com sucesso (\`npm run stress:5000\`), com média de 1.000 requisições por papel operacional sem falhas de conexão.
* **Validação dos 4 APKs Nativos:** Compilação com Gradle 9.6.0, AGP 9.4.1 e Java 17 LTS com zero alertas impeditivos.
* **Teste de Abertura 100% Offline (Modo Avião):** Os 4 APKs abriram em ~0.05s em modo avião, servindo páginas e assets locais sem nenhuma tela de bloqueio de rede.
* **Integridade da Base Operacional:** 620 produtos ativos e 1.236.986 unidades em estoque auditadas sem divergência de chaves estrangeiras (\`PRAGMA foreign_key_check\`).

---

## 2. DETALHAMENTO DAS SUÍTES DE TESTES DA API (JEST)
Total de 101 testes unitários e de integração cobrindo cenários críticos:

| Suíte de Teste (\`tests/\`) | Testes | Escopo Validado | Resultado |
| :--- | :---: | :--- | :---: |
| \`auth.test.js\` | 3 | Login, tokens JWT, invalidação de senha e logout. | APROVADO |
| \`catalog.test.js\` | 2 | Consulta de produtos, filtros por SKU e promoções. | APROVADO |
| \`clients.test.js\` | 3 | Cadastro, CNPJ/CPF, carteira de vendedores e busca. | APROVADO |
| \`crm.test.js\` | 4 | Interações, histórico de atendimentos e clonagem de pedidos. | APROVADO |
| \`dashboard.test.js\` | 3 | Indicadores de faturamento, tickets e metas de vendedores. | APROVADO |
| \`direct_delivery_complete.test.js\` | 4 | Baixa expressa direta pela Torre sem veículo. | APROVADO |
| \`fresh_install.test.js\` | 1 | Instalação limpa, banco inicial e token de primeiro admin. | APROVADO |
| \`logistics.test.js\` | 3 | Formação de rotas e cálculo de sequenciamento. | APROVADO |
| \`logistics_extended.test.js\` | 5 | Agrupamento por bairros e conferência de carregamento. | APROVADO |
| \`logistics_lifecycle_exhaustive.test.js\`| 23 | Ciclo completo de entrega, retorno, reversão e baixa. | APROVADO |
| \`orders.test.js\` | 2 | Criação de pedidos com desconto e reserva de estoque. | APROVADO |
| \`orders_extended.test.js\` | 10 | Cancelamento com estorno, recálculo e precisão em centavos. | APROVADO |
| \`price_tables.test.js\` | 8 | Tabelas de preço, quantidade mínima e faixas de desconto. | APROVADO |
| \`realtime.test.js\` | 6 | Tickets SSE, multiplexação, heartbeat e filtro por role. | APROVADO |
| \`routing.test.js\` | 6 | Otimização geoespacial viária e ordenação de paradas. | APROVADO |
| \`stock.test.js\` | 3 | Movimentações, estoque mínimo, crítico e alertas. | APROVADO |
| \`suppliers_inbound.test.js\` | 10 | Compras, vínculo de fornecedor e entrada com leitor de código. | APROVADO |
| \`users.test.js\` | 1 | Listagem de usuários e regras de sanitização. | APROVADO |
| \`users_crud.test.js\` | 4 | Criação, alteração, redefinição de senha e desativação. | APROVADO |

---

## 3. VALIDAÇÃO DE CONFORMIDADE DOS APKS ANDROID
* **XiquimVargas-Vendedor-1.8.3.apk (28 MB):** Subtítulos no tom institucional Laranja (\`#FD5E02\`), catálogo completo, navegação rápida, gravação de pedidos em outbox IndexedDB.
* **XiquimVargas-Motorista-1.8.3.apk (28 MB):** Acesso a rotas viárias, abertura de chamadas/WhatsApp no aplicativo nativo correspondente, câmera para foto de comprovante e registro de insucesso.
* **XiquimVargas-PDV-1.8.3.apk / Caixa (28 MB):** Bipagem contínua via leitor, integração com gerenciador de impressão nativo do Android, cálculo de troco.
* **XiquimVargas-TorreControle-1.8.3.apk (28 MB):** Acesso total aos gráficos em tempo real, painel de retornos logísticos e ferramentas executivas.
`;

export const doc08 = `# AUTONOMIA SYSTEMS — PLANO DE TRANSIÇÃO E ACEITE FORMAL
**Roteiro de Transição, Operação Assistida, Homologação e Termo de Aceite**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Data:** Outubro de 2026

---

## 1. ROTEIRO DE TRANSIÇÃO E GO-LIVE
O processo de entrada em produção plena (Go-Live) obedece ao cronograma estruturado abaixo:

1. **Fase 1 — Infraestrutura e Persistência em Nuvem (Concluída):**
   * Publicação do ambiente oficial no Render sob HTTPS: \`https://xiquim-vargas-erp.onrender.com\`.
   * Montagem e homologação do disco persistente de 10GB em \`/var/data\`.
2. **Fase 2 — Base de Dados e Auditoria (Concluída):**
   * Homologação dos 620 SKUs comerciais com fotos HD oficiais e estoque inicial ativo (1.236.986 unidades).
   * Validação de todos os perfis operacionais, credenciais de acesso e cadastros de clientes da carteira.
3. **Fase 3 — Distribuição dos 4 Aplicativos Nativos (Em Execução):**
   * Instalação dos APKs v1.8.3 nos smartphones e terminais da equipe de vendas, caixa, logística e diretoria.
4. **Fase 4 — Operação Assistida (15 Dias):**
   * Acompanhamento presencial e remoto dos turnos operacionais, conferência de doca e validação do fluxo de retornos.
5. **Fase 5 — Transferência Definitiva e Aceite:**
   * Entrega dos códigos-fonte, credenciais e termo de aceite formal assinado.

---

## 2. CRITÉRIOS DE ACEITAÇÃO CONTRATUAL
Para a emissão do aceite formal, o sistema cumpriu rigorosamente os requisitos:
* [X] Plataforma acessível via web e aplicativo nativo com latência adequada e zero travamentos.
* [X] 4 APKs Android nativos compilados com sucesso e com funcionamento 100% offline atestado.
* [X] Transações de venda com cálculo em centavos e proteção contra saldo negativo de estoque.
* [X] Sincronização em tempo real (SSE) operando sem a necessidade de recarregamento manual (F5).
* [X] Rotina de devoluções com reversão automática de pedidos e desacoplamento de rotas.
* [X] Doca de compras com conferência por código de barras e alimentação de estoque.
* [X] Política de backup automatizada com verificação de integridade e retenção de 7 dias.

---

## 3. TERMO DE ACEITE FORMAL DE ENTREGA DE SOFTWARE

Pelo presente instrumento, a empresa **Xiquim Vargas** declara que recebeu da **AutonomIA Systems** a entrega formal da release definitiva do **ERP AutonomIA (Versão 2.2.1 / 1.8.2 Delivery Hardened)**, acompanhada de toda a documentação técnica, manuais operacionais e a suíte de 4 aplicativos nativos Android v1.8.3.

Declara-se que todos os fluxos comerciais, de frente de caixa, estoque, compras, loja online e expedição logística foram testados e homologados, encontrando-se em plena conformidade com as especificações contratadas.

Data de Homologação: 27 de Outubro de 2026.

_______________________________________________  
**Xiquim Vargas — Direção Geral**

_______________________________________________  
**AutonomIA Systems — Engenharia de Software**
`;

fs.writeFileSync(path.join(outDir, '06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.md'), doc06, 'utf8');
fs.writeFileSync(path.join(outDir, '07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.md'), doc07, 'utf8');
fs.writeFileSync(path.join(outDir, '08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.md'), doc08, 'utf8');
console.log('-> 06, 07 e 08 gerados com sucesso.');
