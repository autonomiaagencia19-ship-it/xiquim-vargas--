# AUTONOMIA SYSTEMS — MANUAL DE OPERAÇÕES
**Guia Operacional e Funcional Completo do Dia a Dia**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3 (100% Offline)  
**Ambiente Oficial:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. PROPÓSITO E ARQUITETURA DE CANAIS
O **ERP AutonomIA** unifica de ponta a ponta as frentes de atendimento, vendas omni-channel, faturamento de balcão (PDV), gestão de preços, controle de estoque com 626 produtos homologados (100.000 un por item para inauguração), compras e doca de recebimento, CRM comercial e expedição logística com 4 aplicativos nativos Android.

A solução atende aos múltiplos canais operacionais integrados à mesma base de dados transacional:
* **Loja Online (Web E-Commerce):** Canal digital de autoatendimento para clientes finais e corporativos em `https://xiquim-vargas-erp.onrender.com/loja.html`.
* **Venda Externa (App Vendedor):** Aplicativo móvel (`XiquimVargas-Vendedor-1.8.3.apk`) com catálogo completo, gestão de clientes, metas e textos de subtítulos destacados no tom oficial Laranja Institucional (`#FD5E02`).
* **Frente de Caixa e Balcão (PDV):** Terminal ágil (`XiquimVargas-PDV-1.8.3.apk` ou `pdv.html`) com leitor de código de barras, múltiplos meios de pagamento e impressão térmica.
* **Torre de Controle (Gestão Central):** Centro de comando executivo (`XiquimVargas-TorreControle-1.8.3.apk` ou `admin.html`) com dashboards em tempo real, gestão de preços, expedição e monitoramento de retornos.
* **Logística e Entregas (App Motorista):** Aplicativo nativo (`XiquimVargas-Motorista-1.8.3.apk`) com rotas otimizadas, contato via WhatsApp com o cliente em 1 clique e protocolo de insucesso de entrega com reversão automática.

---

## 2. SUÍTE DOS 4 APLICATIVOS ANDROID NATIVOS (100% OFFLINE)
O ecossistema disponibiliza 4 aplicativos Android nativos de alto desempenho na pasta `/dist-apks/`:

| Aplicativo APK | Perfil Operacional | Destaques Técnicos e Funcionalidades |
| :--- | :--- | :--- |
| **XiquimVargas-Vendedor-1.8.3.apk** | Vendedor Externo / Representante | 100% Offline; abre em 0.05s sem rede; catálogo com 626 produtos; emissão de pedidos; subtítulos laranja institucional (#FD5E02). |
| **XiquimVargas-Motorista-1.8.3.apk** | Motorista / Entregador | 100% Offline; roteirização; botão de WhatsApp e ligação rápida para cada parada; registro de fotos/assinatura e reversão de retorno. |
| **XiquimVargas-PDV-1.8.3.apk** | Operador de Caixa / Balcão | 100% Offline; leitor de código de barras; venda balcão expressa; impressão térmica de comprovantes. |
| **XiquimVargas-TorreControle-1.8.3.apk** | Gestor / Supervisor / Expedição | Visão completa da operação; painel de pedidos retornados; gestão de estoque; liberação de cargas e relatórios executivos. |

### 2.1 Como Funciona a Abertura 100% Offline
Ao contrário de WebViews convencionais que falham com a mensagem `ERR_NAME_NOT_RESOLVED` na ausência de sinal, os 4 APKs utilizam o mecanismo `WebViewAssetLoader` no `MainActivity.kt`:
1. Todos os arquivos de interface (`vendedor.html`, `motorista.html`, `pdv.html`, `admin.html`, scripts, estilos e logos HD) estão **embutidos dentro do APK nativo** em `app/src/main/assets/www/`.
2. O aplicativo intercepta as requisições de rede localmente (`shouldInterceptRequest`). Mesmo em modo avião ou em áreas rurais sem sinal, o app abre de forma instantânea.
3. A URL oficial de produção (`https://xiquim-vargas-erp.onrender.com`) está pré-configurada no código-fonte. Quando o dispositivo detecta internet, ele se conecta e sincroniza automaticamente sem requerer nenhuma intervenção ou digitação de URL pelo usuário.
4. Todos os 4 APKs exibem o **ícone HD oficial** (`01_Logo_Xiquim_Vargas_HD.png`) na tela inicial e no menu do celular.

---

## 3. SINCRONIZAÇÃO EM TEMPO REAL (ZERO RELOAD)
O ERP AutonomIA opera com sincronização instantânea de dados entre todas as interfaces através de Server-Sent Events (SSE) e canais de mensageria local (`BroadcastChannel`):
* **Atualização Sem F5:** Quando um pedido é finalizado pelo vendedor ou pela loja online, os contadores e os cards da Torre de Controle se atualizam no mesmo segundo, com realce visual temporário.
* **Resiliência de Rede:** Em caso de oscilações, o subsistema reconecta automaticamente com backoff exponencial e revalida os dados da tela sem interrupção do operador.

---

## 4. BASE DE DADOS HOMOLOGADA PARA INAUGURAÇÃO
O sistema entra em operação com base rigorosamente higienizada e auditada:
* **626 Produtos Homologados:** Cadastro completo com descrições, preços, categorias e imagens em alta definição.
* **Estoque de Inauguração:** Cada um dos 626 produtos possui exatamente **100.000 unidades disponíveis**, totalizando **62.600.000 unidades em estoque**, permitindo início imediato das vendas em todos os canais.
* **Operadores Ativos:** 118 colaboradores cadastrados com seus respectivos perfis e acessos protegidos por senha com hash criptográfico.
* **Cliente Balcão Padrão:** Registro `CLIENTE-BALCAO` preservado para atendimento rápido no caixa sem burocracia.
