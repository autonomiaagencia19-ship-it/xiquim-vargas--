import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('xiquimvargasmanuais');

export const doc02 = `# AUTONOMIA SYSTEMS — RUNBOOK OPERACIONAL
**Procedimentos Padrão (SOP), Rotinas Diárias, Gestão de Devoluções e Contingência**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3  
**Ambiente:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. OBJETIVO E ESCOPO
Este documento define as rotinas operacionais padrão (SOP - Standard Operating Procedures) a serem executadas diariamente pelas equipes da Torre de Controle, Frente de Caixa (PDV), Expedição e Logística, Doca de Recebimento, Vendedores Externos e Motoristas do Xiquim Vargas.

---

## 2. CHECKLIST MATINAL DE ABERTURA DE TURNO (30 MINUTOS ANTES)
Trinta minutos antes da abertura da empresa ou início da saída dos caminhões, o encarregado operacional deve executar os passos abaixo:

1. **Verificação de Saúde do Servidor em Nuvem:**
   * Acessar \`https://xiquim-vargas-erp.onrender.com/ready\`.
   * Confirmar retorno HTTP 200: \`{ "ok": true, "ready": true, "version": "1.8.2" }\`.
   * Acessar \`https://xiquim-vargas-erp.onrender.com/health\` para atestar tempo de atividade (\`uptime_seconds\`) e modo do banco (\`sqlite-wal\`).
2. **Conexão em Tempo Real na Torre de Controle:**
   * Abrir a Torre de Controle (\`admin.html\` ou app nativo \`XiquimVargas-TorreControle-1.8.3.apk\`).
   * Validar se o indicador de conexão em tempo real (bolinha verde no topo) está ativo.
3. **Triagem de Pedidos Noturnos e Matinais:**
   * Filtrar o painel por pedidos \`PENDENTE\` (vindos da Loja Online durante a noite ou emitidos por vendedores).
   * Validar itens e limite de crédito/pagamento antes de liberar para a separação física.
4. **Alocação de Equipes e Veículos:**
   * Conferir a escala dos motoristas escalados para o turno e a disponibilidade dos veículos da frota.
   * Abrir o módulo de rotas logísticas e validar a distribuição de bairros por dia da semana.

---

## 3. ROTINAS DE OPERAÇÃO DO PDV E FRENTE DE CAIXA
Para operadores de balcão utilizando \`pdv.html\` ou o app \`XiquimVargas-PDV-1.8.3.apk\` / \`XiquimVargas-Caixa-1.8.3.apk\`:

1. **Abertura de Caixa:**
   * Realizar login no terminal com seu usuário (\`cashier\`).
   * Confirmar o cliente padrão de balcão (\`CLIENTE-BALCAO\` / Consumidor Final).
2. **Bipagem e Registro de Produtos:**
   * Bipar o código de barras do produto diretamente no leitor óptico ou digitar pelo menos 2 caracteres do nome/SKU.
   * Ajustar a quantidade desejada. O sistema verifica instantaneamente o estoque disponível (\`quantidade_disponivel\`).
3. **Finalização e Pagamento:**
   * Selecionar o meio de pagamento acordado: Dinheiro, Débito, Crédito ou PIX.
   * Se Dinheiro: inserir o valor recebido; o sistema calcula e exibe o troco na tela com destaque.
   * Se Crédito: selecionar modalidade à vista ou parcelado (de 2 a 12 vezes).
   * Clicar em **"Finalizar Venda"**. O comprovante térmico é gerado para impressão.
4. **Operação em Contingência (Sem Internet):**
   * O aplicativo opera normalmente offline. As vendas são gravadas localmente em IndexedDB (\`xv-offline-v1-...\`).
   * Não fechar o aplicativo ou limpar o cache do navegador até a conexão retornar. Ao reestabelecer o sinal, a fila sincroniza no servidor de forma transparente.

---

## 4. EXPEDIÇÃO, MONTAGEM DE CARGA E ROTEIRIZAÇÃO
1. **Separação de Mercadorias:**
   * Na Torre de Controle, selecionar pedidos em status \`SEPARACAO\`.
   * Clicar em **"Imprimir Romaneio de Carga (PDF)"** para entrega aos estoquistas no depósito.
2. **Criação da Rota Logística:**
   * Acessar a aba **Logística** e selecionar os pedidos agrupados por bairros e zonas viárias.
   * Definir o motorista responsável e a placa do veículo.
   * Clicar em **"Criar e Despachar Rota"**. O status dos pedidos avança de \`SEPARACAO\` para \`ROTA\`.
3. **Carregamento do Veículo:**
   * Conferir a carga física na doca contra o PDF de lista de carregamento antes da saída do portão.

---

## 5. OPERAÇÃO DO MOTORISTA E GESTÃO DE OCORRÊNCIAS
O motorista opera com o aplicativo nativo \`XiquimVargas-Motorista-1.8.3.apk\`:

1. **Visualização das Paradas:**
   * O motorista abre o app; as entregas do dia aparecem ordenadas por prioridade viária.
2. **Comunicação Prévia:**
   * Antes de chegar ao destino, o motorista toca no ícone de **WhatsApp** ou **Telefone** para avisar o cliente em 1 clique.
3. **Entrega com Sucesso:**
   * No momento da entrega, o motorista clica em **"Anexar Comprovante"**, fotografa o canhoto assinado ou a fachada com o produto e clica em **"Concluir Entrega"**.
   * O pedido avança para \`CONCLUIDO\` e o estoque reservado é baixado definitivamente no servidor.
4. **Protocolo de Insucesso (Não Entregue):**
   * Se o cliente estiver ausente, estabelecimento fechado ou recusa de entrega:
   * O motorista toca em **"Registrar Retorno"**, seleciona o motivo (ex: "Cliente Ausente", "Endereço Incorreto", "Recusa") e detalha a ocorrência.
   * **Reversão Automática:** O status do pedido retorna de \`ROTA\` diretamente para \`SEPARACAO\`.
   * O pedido é desacoplado do veículo e ressurge imediatamente na Torre de Controle no painel **"Pedidos que Retornaram"**.

---

## 6. DOCA DE RECEBIMENTO (INBOUND) E ENTRADA DE FORNECEDORES
1. Ao chegar caminhão de fornecedor com mercadorias:
   * Acessar na Torre de Controle o menu **Compras / Inbound**.
   * Localizar a Ordem de Compra correspondente (\`SOLICITADO\` ou \`CONFIRMADO\`).
2. **Conferência Cega / Bipagem:**
   * Bipar os códigos de barras das caixas recebidas no campo de busca inbound (\`/api/inbound/barcode\`).
   * Validar as quantidades físicas entregues contra o faturamento do fornecedor.
3. **Efetivação de Entrada:**
   * Clicar em **"Confirmar Recebimento"** (\`POST /api/purchases/:id/receive\`).
   * O estoque é incrementado no mesmo segundo, o preço de custo é auditado no histórico (\`produto_custos_historico\`) e os eventos SSE de atualização de estoque disparam para todas as telas.

---

## 7. FECHAMENTO DE TURNO E CONCILIAÇÃO
Ao término do expediente diário:
1. **Fechamento dos Caixas:**
   * Realizar a sangria e fechamento nos terminais PDV, conferindo valores físicos contra o relatório do turno.
2. **Conferência de Retornos Físicos:**
   * A expedição confere fisicamente as caixas que voltaram com os motoristas, confrontando com a lista da Torre.
   * As caixas retornam para o galpão e os pedidos ficam aptos para reembarque no dia útil seguinte.
3. **Execução de Backup Operacional:**
   * O servidor executa automaticamente o backup noturno diário (\`npm run backup\`). O encarregado pode validar a pasta \`/var/data/backups/\`.

---

## 8. INSTALAÇÃO E DISTRIBUIÇÃO DOS 4 APKS NATIVOS
Os aplicativos encontram-se prontos para distribuição na pasta \`/dist-apks/\`:
* \`XiquimVargas-Vendedor-1.8.3.apk\`
* \`XiquimVargas-Motorista-1.8.3.apk\`
* \`XiquimVargas-PDV-1.8.3.apk\` / \`XiquimVargas-Caixa-1.8.3.apk\`
* \`XiquimVargas-TorreControle-1.8.3.apk\`

### 8.1 Passo a Passo de Instalação no Celular Android:
1. Enviar o arquivo APK para o celular do colaborador (via WhatsApp, e-mail, cabo USB ou download direto).
2. Tocar no arquivo e autorizar a opção "Permitir desta fonte" (Fontes Desconhecidas).
3. Concluir a instalação e abrir o app.
4. O aplicativo já abre instantaneamente na tela de trabalho com o logotipo oficial HD, sem precisar de configuração adicional de servidor ou digitação de URL.
`;

export const doc03 = `# AUTONOMIA SYSTEMS — ENGINEERING HANDOFF
**Arquitetura de Software, Componentes Técnicos, Invariantes e Sustentação de Engenharia**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3  
**Produção:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. ARQUITETURA GERAL E PILARES TÉCNICOS
O ERP AutonomIA foi projetado sob o padrão de **alta eficiência, zero-bloat runtime, segurança transacional estrita e latência sub-milissegundo**:

* **Backend Runtime:** Node.js 22 LTS em ESM nativo (\`import/export\`), sem intermediários como Express ou frameworks pesados. O servidor HTTP nativo (\`server.js\`) entrega rotas REST e streaming em tempo real com consumo mínimo de memória RAM (~65MB em repouso).
* **Camada de Dados Transacional:** SQLite nativo (\`node:sqlite\` - \`DatabaseSync\`) operando com \`PRAGMA journal_mode=WAL\`, \`PRAGMA foreign_keys=ON\` e \`PRAGMA busy_timeout=5000\`. Todas as mutações multi-entidade são empacotadas na função transacional \`tx(() => { ... })\`, assegurando isolamento ACID absoluto.
* **Camada de Apresentação:** Vanilla HTML5, CSS3 moderno e JavaScript ES6+ modular (\`app.js\` e \`role.js\`). Zero tempo de compilação no deploy e renderização instantânea no navegador.
* **Barramento em Tempo Real:** Motor Server-Sent Events (SSE) nativo (\`/api/events\`) com autenticação via ticket criptográfico, heartbeat a cada 25 segundos e controle de vazamento de memória (máximo de 3 conexões simultâneas por usuário).
* **Motor de PDF Vetorial Puro:** Implementação em JavaScript puro (\`src/pdf.js\`) que constrói documentos PDF vetoriais em milissegundos sem necessidade de instâncias pesadas de Chromium ou bibliotecas binárias externas.
* **Inteligência Artificial Administrativa:** Módulo \`src/ai.js\` conectado à API Groq (modelo \`openai/gpt-oss-120b\`) com ferramentas estritas de leitura parametrizada do banco de dados para assistência analítica executiva.

---

## 2. ARQUITETURA MOBILE DOS 4 APKS NATIVOS (100% OFFLINE)
A suíte mobile nativa localiza-se no diretório \`mobile/\`:
* \`mobile/seller-native\` (Vendedor Externo)
* \`mobile/driver-native\` (Motorista de Entregas)
* \`mobile/pdv-native\` (Frente de Caixa e Balcão)
* \`mobile/tower-native\` (Torre de Controle Móvel)

### 2.1 Mecanismo de Interceptação Local de Assets
Cada aplicativo Android implementa no \`MainActivity.kt\` o interceptador de requisições de rede:
\`\`\`kotlin
webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        val uri = request?.url ?: return null
        return interceptAsset(uri) ?: super.shouldInterceptRequest(view, request)
    }
}
\`\`\`
* **Mapeamento de Assets:** A função \`interceptAsset\` mapeia rotas estáticas para a pasta interna \`app/src/main/assets/www/\`.
* **Desempenho Offline:** Caso o celular esteja sem sinal ou em Modo Avião, o WebView carrega os scripts, estilos e interfaces HTML locais em menos de 0.05s, sem emitir \`ERR_NAME_NOT_RESOLVED\`.
* **Ponte Nativa (\`AndroidAppBridge\`):** O aplicativo expõe interfaces nativas para o JavaScript:
  - \`AndroidApp.openPdf(url, filename)\`: Abre documentos PDF no visualizador nativo do Android.
  - \`AndroidApp.printWebPage()\`: Aciona a fila de impressão térmica nativa do sistema operacional.
  - \`AndroidApp.getBaseUrl()\`: Retorna a URL base do servidor ERP (\`https://xiquim-vargas-erp.onrender.com\`).
  - \`AndroidApp.getRole()\`: Retorna o papel operacional fixo do aplicativo (\`seller\`, \`driver\`, \`cashier\`, \`admin\`).
  - \`AndroidApp.getAppVersion()\`: Retorna a versão de compilação (\`1.8.3\`).

### 2.2 Monitoramento Dinâmico de Rede
\`MainActivity.kt\` registra um callback contínuo (\`ConnectivityManager.NetworkCallback\`). Quando a conectividade é reestabelecida, o app comuta automaticamente \`cacheMode = WebSettings.LOAD_DEFAULT\` e dispara o evento JavaScript \`window.dispatchEvent(new Event('online'))\`, disparando \`syncOfflineQueue()\` para enviar vendas e comprovantes pendentes.

---

## 3. SEGURANÇA E INVARIANTES DE ENGENHARIA
1. **Armazenamento de Senhas:** Hashing criptográfico \`scrypt\` com salt pseudoaleatório de 16 bytes e derivação de chave de 64 bytes (\`scrypt$salt$hash\`). Senhas nunca são salvas em texto claro.
2. **Tokens JWT:** Assinatura HMAC-SHA256 com segredo persistente (\`JWT_SECRET\`), tempo de expiração de 30 dias (2.592.000 segundos) e sanitização estrita de payload.
3. **Proteção Contra Força Bruta e DoS:**
   - Limite de 20 tentativas de login por IP a cada 60 segundos (\`LOGIN_MAX = 20\`).
   - Limite de 600 requisições gerais por IP a cada 60 segundos (\`API_MAX = 600\`).
4. **Precisão Financeira em Centavos:** Cálculos de pedidos, itens e descontos são operados em centavos inteiros antes da gravação no banco de dados, prevenindo imprecisões de ponto flutuante IEEE 754.
5. **Auditoria Contínua:** Todas as mutações de pedidos, estoque, preços, clientes, rotas e compras geram registros imediatos na tabela \`audit_logs\`.
`;

export const doc04 = `# AUTONOMIA SYSTEMS — DEPLOY E OPERAÇÃO TÉCNICA
**Render PaaS, Arquitetura de Persistência, Topologia de Disco e Rotinas de Backup**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Produção:** https://xiquim-vargas-erp.onrender.com  
**Data:** Outubro de 2026

---

## 1. BLUEPRINT DE INFRAESTRUTURA NO RENDER (PAAS)
A aplicação em produção está hospedada na plataforma Render sob a especificação declarativa do arquivo \`render.yaml\`:

\`\`\`yaml
services:
  - type: web
    name: xiquim-vargas-erp
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /ready
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: STORAGE_DIR
        value: /var/data
      - key: PUBLIC_BASE_URL
        sync: false
    disk:
      name: erp-data
      mountPath: /var/data
      sizeGB: 10
\`\`\`

---

## 2. TOPOLOGIA DO DISCO PERSISTENTE (/var/data)
O disco persistente de 10GB montado em \`/var/data\` garante a longevidade dos dados independentemente de novos deploys de software ou reinicializações do container:

* \`/var/data/xiquim-vargas.db\`: Banco de dados relacional principal em SQLite WAL.
* \`/var/data/xiquim-vargas.db-wal\` e \`.db-shm\`: Arquivos temporários de log e memória compartilhada do modo Write-Ahead Logging.
* \`/var/data/proofs/\`: Fotos de comprovantes de entrega e canhotos capturados pelos motoristas.
* \`/var/data/product-images/\`: Fotos do catálogo oficial dos 620 produtos.
* \`/var/data/store-cover/\`: Banners e imagens de capa personalizadas da Loja Online.
* \`/var/data/pdfs/\`: Documentos PDF gerados sob demanda (pedidos e romaneios).
* \`/var/data/backups/\`: Snapshots diários completos do banco e mídias.

### 2.1 Garantia de Não Sobrescrita em Novos Deploys
No arquivo \`src/db.js\`, a rotina de inicialização protege a base existente:
\`\`\`javascript
if (path.resolve(bundledDb) !== path.resolve(targetDb) && fs.existsSync(bundledDb) && !fs.existsSync(targetDb)) {
    console.log('[bootstrap] Inicializando banco persistente a partir do repositório...');
    fs.copyFileSync(bundledDb, targetDb);
}
\`\`\`
**Regra Fundamental:** Se o arquivo \`/var/data/xiquim-vargas.db\` já existir no disco persistente do Render, o repositório **jamais** sobrescreve o banco. Toda a movimentação real, clientes, operadores e pedidos em produção permanecem 100% íntegros.

---

## 3. SUBSISTEMA DE BACKUP AUTOMATIZADO
O backup é realizado pelo script \`scripts/backup.mjs\` (acionado por \`npm run backup\`):
1. **Checkpoint de WAL:** Executa \`PRAGMA wal_checkpoint(TRUNCATE)\` para consolidar todas as transações pendentes no arquivo \`.db\` principal.
2. **Snapshot Atômico (\`VACUUM INTO\`):** Cria uma cópia íntegra e desfragmentada do banco sem travar as operações ativas de leitura e escrita.
3. **Checagem de Integridade Imediata:** Abre a réplica gerada e executa \`PRAGMA integrity_check\`. Se houver qualquer indício de corrupção, o processo aborta e emite alerta.
4. **Espelhamento das Mídias:** Copia as pastas \`product-images\`, \`proofs\`, \`store-cover\` e \`pdfs\`.
5. **Manifesto Criptográfico:** Gera o arquivo \`manifest.sha256\` contendo o hash de cada arquivo empacotado.
6. **Política de Retenção (Rolling 7 Dias):** Mantém os últimos 7 snapshots diários no disco, removendo snapshots mais antigos para preservar o espaço em disco.

---

## 4. PROCEDIMENTO DE RECUPERAÇÃO DE DESASTRES (RESTORE)
Em caso de necessidade de restauração:
1. Conectar via terminal SSH ou CLI do Render ao serviço.
2. Parar a aplicação temporariamente.
3. Copiar o banco de dados do snapshot desejado em \`/var/data/backups/AAAA-MM-DD/xiquim-vargas.db\` para \`/var/data/xiquim-vargas.db\`.
4. Validar o hash SHA256 contra o \`manifest.sha256\`.
5. Reiniciar o serviço. O health check em \`/ready\` confirmará a restauração bem-sucedida.
`;

fs.writeFileSync(path.join(outDir, '02_Runbook_Operacional_AutonomIA_ERP_2.2.1.md'), doc02, 'utf8');
fs.writeFileSync(path.join(outDir, '03_Engineering_Handoff_AutonomIA_ERP_2.2.1.md'), doc03, 'utf8');
fs.writeFileSync(path.join(outDir, '04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.md'), doc04, 'utf8');
console.log('-> 02, 03 e 04 gerados com sucesso.');
