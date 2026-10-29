import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('xiquimvargasmanuais');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

export const doc01 = `# AUTONOMIA SYSTEMS — MANUAL DE OPERAÇÕES
**Guia Operacional e Funcional Completo do Dia a Dia**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3 (100% Offline)  
**Ambiente Oficial de Produção:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. PROPÓSITO E ARQUITETURA DE CANAIS
O **ERP AutonomIA (Xiquim Vargas)** é uma plataforma integrada de gestão empresarial desenvolvida para unificar de ponta a ponta todas as frentes de atendimento, vendas omni-channel, faturamento de balcão (PDV), gestão dinâmica de preços, controle rigoroso de estoque, compras e doca de recebimento (inbound), inteligência comercial de clientes (CRM) e expedição logística com rastreamento móvel nativo.

A solução atende simultaneamente aos múltiplos canais operacionais integrados à mesma base de dados transacional em tempo real:
* **Torre de Controle (Gestão Central):** Centro de comando executivo em \`admin.html\` ou pelo aplicativo nativo \`XiquimVargas-TorreControle-1.8.3.apk\`, com dashboards em tempo real, painel Kanban de pedidos, estoque central, precificação, liberação de cargas e monitoramento de retornos logísticos.
* **Frente de Caixa e Balcão (PDV):** Terminal de alta velocidade em \`pdv.html\` ou pelo aplicativo nativo \`XiquimVargas-PDV-1.8.3.apk\` (também distribuído como \`XiquimVargas-Caixa-1.8.3.apk\`), com suporte a leitor de código de barras, múltiplos meios de pagamento (Dinheiro, Débito, Crédito à vista/parcelado de 2x a 12x, PIX), cálculo de troco automático e impressão térmica.
* **Venda Externa (App Vendedor):** Aplicativo móvel nativo (\`XiquimVargas-Vendedor-1.8.3.apk\` ou \`vendedor.html\`) com catálogo completo de 620 produtos ativos, gestão de carteira de clientes, metas mensais, histórico de compras e emissão de pedidos com outbox offline sincronizável.
* **Loja Online (Web E-Commerce B2B/B2C):** Canal digital de autoatendimento para clientes finais e corporativos em \`https://xiquim-vargas-erp.onrender.com/loja.html\`, com catálogo dinâmico de produtos, cálculo automático de frete por bairro, pedido mínimo parametrizável e auto-cadastro.
* **Logística e Entregas (App Motorista):** Aplicativo móvel nativo (\`XiquimVargas-Motorista-1.8.3.apk\` ou \`motorista.html\`) com listagem ordenada de rotas do dia, atalhos de discagem e WhatsApp em 1 clique para cada cliente, registro de comprovantes fotográficos e protocolo de insucesso de entrega com reversão automática.
* **Doca de Recebimento e Compras (Inbound):** Módulo de controle de fornecedores, emissão de pedidos de compra e conferência física com leitor de código de barras, alimentando automaticamente o estoque comercial e registrando o histórico de custos.

---

## 2. SUÍTE DOS 4 APLICATIVOS ANDROID NATIVOS (100% OFFLINE)
O ecossistema móvel conta com 4 aplicativos nativos desenvolvidos em Kotlin e compilados com Gradle 9.6.0 (AGP 9.4.1 / Java 17 LTS / API 26..35). Todos os APKs encontram-se disponíveis nas pastas \`/dist-apks/\`, \`/mobile/apks/\`, \`/apks versao final/\` e na raiz do projeto:

| Aplicativo APK | Perfil Operacional | Destaques Técnicos e Funcionalidades |
| :--- | :--- | :--- |
| **XiquimVargas-Vendedor-1.8.3.apk** | Vendedor Externo / Representante | 100% Offline; abertura em ~0.05s sem sinal; catálogo de 620 produtos; emissão de pedidos em fila local (IndexedDB); subtítulos no tom oficial Laranja (#FD5E02). |
| **XiquimVargas-Motorista-1.8.3.apk** | Motorista / Entregador | 100% Offline; roteirização viária; botões de contato direto (WhatsApp/Ligação); captura de fotos de comprovante; protocolo de retorno com reversão automática. |
| **XiquimVargas-PDV-1.8.3.apk** *(ou Caixa)* | Operador de Caixa / Frente de Loja | 100% Offline; leitor de código de barras; venda expressa de balcão; comprovante térmico; múltiplos meios de pagamento; cliente padrão CLIENTE-BALCAO. |
| **XiquimVargas-TorreControle-1.8.3.apk** | Gestor Geral / Expedição / Fiscal | Visão completa da operação; painel de pedidos retornados; gestão de estoque; liberação de cargas; relatórios executivos e IA Administrativa. |

### 2.1 Arquitetura de Abertura 100% Offline e Fallback Automático
Diferente de aplicativos híbridos convencionais que exibem a tela de erro \`ERR_NAME_NOT_RESOLVED\` na ausência de sinal, os 4 APKs utilizam o mecanismo \`WebViewAssetLoader\` com interceptação no \`MainActivity.kt\`:
1. **Assets Embutidos no APK:** Todos os arquivos de interface (\`vendedor.html\`, \`motorista.html\`, \`pdv.html\`, \`admin.html\`, estilos \`styles.css\`, scripts \`app.js\` e \`role.js\`, além dos logos institucionais em alta definição) estão gravados dentro do pacote em \`app/src/main/assets/www/\`.
2. **Interceptação Nativa (\`shouldInterceptRequest\`):** Ao abrir o app, qualquer chamada para páginas ou assets locais é servida do próprio armazenamento interno do smartphone em ~0.05s, mesmo em Modo Avião.
3. **URL Oficial Fixa Embutida:** A URL de produção (\`https://xiquim-vargas-erp.onrender.com\`) está pré-configurada em código nativo (\`Api.kt\`). O colaborador não precisa digitar endereços de servidor.
4. **Fila Local em IndexedDB:** Caso o operador emita um pedido ou realize uma venda sem conexão, a operação é salva na outbox local (\`xv-offline-v1-...\`). Assim que a internet for detectada, a função \`syncOfflineQueue()\` envia os dados automaticamente para a nuvem.
5. **Ícone Oficial HD Institucional:** Todos os 4 aplicativos exibem o ícone oficial em alta definição (\`01_Logo_Xiquim_Vargas_HD.png\`) na tela inicial e gaveta de aplicativos.

---

## 3. SINCRONIZAÇÃO EM TEMPO REAL (ZERO RELOAD)
O ERP AutonomIA é construído sobre uma arquitetura de sincronização contínua que elimina a necessidade de pressionar F5 ou recarregar a tela:
* **Server-Sent Events (SSE) em \`/api/events\`:** O backend mantém um pool de conexões persistentes com heartbeat periódico a cada 25 segundos.
* **Filtragem de Eventos por Perfil (RBAC):** Cada conexão recebe exclusivamente os eventos pertinentes ao seu papel:
  - *Motoristas:* \`routes_changed\`, \`orders_changed\`, \`returns_changed\`.
  - *Vendedores:* \`stock_changed\`, \`products_changed\`, \`clients_changed\`, \`orders_changed\`, \`prices_changed\`, \`returns_changed\`, \`routes_changed\`.
  - *Caixas:* \`stock_changed\`, \`products_changed\`, \`orders_changed\`, \`prices_changed\`, \`clients_changed\`.
  - *Administradores:* Todos os eventos globais de auditoria, vendas, estoque e logística.
* **BroadcastChannel no Navegador:** Interfaces com múltiplas abas sincronizam dados localmente na memória do dispositivo.
* **Efeito Visual Flash:** Ao receber mutações de pedidos ou estoque, os contadores e cards da Torre de Controle pulsam suavemente para destacar a mudança em tempo real.

---

## 4. BASE DE DADOS HOMOLOGADA E ESTADO ATUAL DO SISTEMA
A base de dados do sistema opera em SQLite nativo sob o arquivo \`xiquim-vargas.db\` em modo Write-Ahead Logging (WAL) com chaves estrangeiras ativas e transações ACID:
* **620 Produtos Ativos (628 Cadastrados):** Cadastro completo com SKU, descrição, marca, sabor, tamanho, unidade e fotos oficiais.
* **1.236.986 Unidades em Estoque:** Distribuição média de ~2.000 unidades disponíveis por produto, com controle rigoroso de saldo reservado (2.525 unidades atualmente vinculadas a pedidos em andamento).
* **Estrutura de Perfis Operacionais (Roles) e Credenciais Seguras:** O sistema opera com isolamento de acessos e senhas protegidas via criptografia \`scrypt\` com salt pseudoaleatório de 16 bytes. Cada perfil funcional foi concebido para atender com máxima agilidade ao seu escopo de atuação:
  - **Administrador (\`admin\`):** Gestão central na Torre de Controle (\`admin.html\` e APK \`XiquimVargas-TorreControle\`). Possui autoridade irrestrita para cadastrar produtos, definir preços e tabelas, gerenciar compras com fornecedores, acompanhar auditoria, liberar cargas e despachar rotas de entrega.
  - **Vendedor Externo (\`seller\`):** Opera pelo aplicativo móvel \`XiquimVargas-Vendedor\` ou \`vendedor.html\`. Acessa o catálogo com fotos e preços dinâmicos, visualiza as metas do mês, gerencia clientes vinculados à sua carteira e emite pedidos mesmo sem internet (salvos localmente na outbox para envio automático posterior).
  - **Operador de Caixa (\`cashier\`):** Opera no terminal de frente de caixa \`XiquimVargas-PDV\` / \`XiquimVargas-Caixa\` ou \`pdv.html\`. Focado em agilidade no balcão presencial: realiza bipagem com leitor de código de barras, registra múltiplos meios de pagamento (Dinheiro com cálculo de troco, Débito, Crédito à vista ou parcelado, PIX), emite comprovantes térmicos e utiliza o cliente padrão pré-cadastrado \`CLIENTE-BALCAO\` (Consumidor Final) para vendas rápidas sem necessidade de cadastro burocrático.
  - **Motorista de Entregas (\`driver\`):** Opera pelo aplicativo móvel \`XiquimVargas-Motorista\` ou \`motorista.html\`. Visualiza a sequência de paradas atribuídas pela expedição, aciona clientes diretamente via WhatsApp ou ligação telefônica em um clique, fotografa canhotos assinados para baixa de entrega e registra devoluções físicas com reversão automática de pedidos.
  - **Cliente Web E-Commerce (\`web_client\`):** Perfil de autoatendimento para clientes finais e corporativos na Loja Online (\`loja.html\`), permitindo navegação pelo catálogo, validação de estoque, montagem de carrinho, cálculo de frete por bairro e acompanhamento do status do pedido.
* **Cadastro de Clientes e Cliente Balcão Padrão:** Gestão comercial com dados cadastrais completos (endereço, bairro, CNPJ/CPF, telefone, tabela de preços e vendedor responsável), incluindo o registro nativo \`CLIENTE-BALCAO\` ("Consumidor Final") mantido para viabilizar faturamentos imediatos de balcão sem burocracia.
* **713 Pedidos no Histórico:** 510 concluídos, 78 pendentes, 53 em rota e 72 em separação.
* **15 Fornecedores e 47 Ordens de Compra:** Controle integrado de suprimentos e histórico contínuo de custo de aquisição (\`produto_custos_historico\`).

---

## 5. CICLO DE VIDA DO PEDIDO E GOVERNANÇA OPERACIONAL
O fluxo de atendimento segue uma máquina de estados estrita:
1. **PENDENTE:** Pedido criado pelo Vendedor, Loja Online ou PDV. O estoque disponível é imediatamente decrementado e transferido para estoque reservado.
2. **SEPARACAO:** A expedição imprime o romaneio e realiza a separação física no galpão.
3. **ROTA:** A expedição vincula o pedido a uma rota de entrega e associa um motorista.
4. **CONCLUIDO:** O motorista entrega a mercadoria, colhe assinatura e foto do comprovante no aplicativo, ou a Torre realiza a baixa direta expressa (\`/api/logistics/orders/complete-direct\`). O estoque reservado é baixado definitivamente como \`SAIDA_VENDA\`.
5. **CANCELADO:** Disponível apenas para administradores. O saldo reservado é estornado integralmente para o estoque disponível.

### 5.1 Protocolo de Insucesso Logístico e Devolução
Quando uma entrega não pode ser realizada (cliente ausente, endereço incorreto, recusa de mercadoria):
* O motorista clica em **"Registrar Retorno"** no aplicativo móvel, seleciona o motivo e anexa uma observação.
* **Reversão Automática:** O status do pedido retorna de \`ROTA\` diretamente para \`SEPARACAO\`, desvinculando-se da rota do veículo e mantendo o estoque reservado.
* **Alerta Instantâneo na Torre:** A Torre de Controle recebe o evento SSE imediatamente no painel **"Pedidos que Retornaram"**, permitindo reprogramação ágil da entrega para o turno seguinte.

---

## 6. POLÍTICA DE BACKUP E SEGURANÇA
* **Disco Persistente de 10GB no Render:** Montado em \`/var/data\` (\`STORAGE_DIR=/var/data\`), isolando banco de dados, comprovantes de entrega, fotos de produtos e PDFs.
* **Garantia de Não Sobrescrita:** A lógica de bootstrap em \`src/db.js\` preserva a integridade da base existente em novos deploys de código.
* **Backups Automáticos Diários:** Executados via \`npm run backup\`, gerando snapshots atômicos (\`VACUUM INTO\`), validação de integridade (\`PRAGMA integrity_check\`), espelhamento de mídias e retenção rolling de 7 dias com manifesto SHA256.
`;

fs.writeFileSync(path.join(outDir, '01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.md'), doc01, 'utf8');
console.log('-> 01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.md gerado com sucesso.');
