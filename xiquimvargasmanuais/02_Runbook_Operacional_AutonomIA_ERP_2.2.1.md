# AUTONOMIA SYSTEMS — RUNBOOK OPERACIONAL
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
   * Acessar `https://xiquim-vargas-erp.onrender.com/ready`.
   * Confirmar retorno HTTP 200: `{ "ok": true, "ready": true, "version": "1.8.2" }`.
   * Acessar `https://xiquim-vargas-erp.onrender.com/health` para atestar tempo de atividade (`uptime_seconds`) e modo do banco (`sqlite-wal`).
2. **Conexão em Tempo Real na Torre de Controle:**
   * Abrir a Torre de Controle (`admin.html` ou app nativo `XiquimVargas-TorreControle-1.8.3.apk`).
   * Validar se o indicador de conexão em tempo real (bolinha verde no topo) está ativo.
3. **Triagem de Pedidos Noturnos e Matinais:**
   * Filtrar o painel por pedidos `PENDENTE` (vindos da Loja Online durante a noite ou emitidos por vendedores).
   * Validar itens e limite de crédito/pagamento antes de liberar para a separação física.
4. **Alocação de Equipes e Veículos:**
   * Conferir a escala dos motoristas escalados para o turno e a disponibilidade dos veículos da frota.
   * Abrir o módulo de rotas logísticas e validar a distribuição de bairros por dia da semana.

---

## 3. ROTINAS DE OPERAÇÃO DO PDV E FRENTE DE CAIXA
Para operadores de balcão utilizando `pdv.html` ou o app `XiquimVargas-PDV-1.8.3.apk` / `XiquimVargas-Caixa-1.8.3.apk`:

1. **Abertura de Caixa:**
   * Realizar login no terminal com seu usuário (`cashier`).
   * Confirmar o cliente padrão de balcão (`CLIENTE-BALCAO` / Consumidor Final).
2. **Bipagem e Registro de Produtos:**
   * Bipar o código de barras do produto diretamente no leitor óptico ou digitar pelo menos 2 caracteres do nome/SKU.
   * Ajustar a quantidade desejada. O sistema verifica instantaneamente o estoque disponível (`quantidade_disponivel`).
3. **Finalização e Pagamento:**
   * Selecionar o meio de pagamento acordado: Dinheiro, Débito, Crédito ou PIX.
   * Se Dinheiro: inserir o valor recebido; o sistema calcula e exibe o troco na tela com destaque.
   * Se Crédito: selecionar modalidade à vista ou parcelado (de 2 a 12 vezes).
   * Clicar em **"Finalizar Venda"**. O comprovante térmico é gerado para impressão.
4. **Operação em Contingência (Sem Internet):**
   * O aplicativo opera normalmente offline. As vendas são gravadas localmente em IndexedDB (`xv-offline-v1-...`).
   * Não fechar o aplicativo ou limpar o cache do navegador até a conexão retornar. Ao reestabelecer o sinal, a fila sincroniza no servidor de forma transparente.

---

## 4. EXPEDIÇÃO, MONTAGEM DE CARGA E ROTEIRIZAÇÃO
1. **Separação de Mercadorias:**
   * Na Torre de Controle, selecionar pedidos em status `SEPARACAO`.
   * Clicar em **"Imprimir Romaneio de Carga (PDF)"** para entrega aos estoquistas no depósito.
2. **Criação da Rota Logística:**
   * Acessar a aba **Logística** e selecionar os pedidos agrupados por bairros e zonas viárias.
   * Definir o motorista responsável e a placa do veículo.
   * Clicar em **"Criar e Despachar Rota"**. O status dos pedidos avança de `SEPARACAO` para `ROTA`.
3. **Carregamento do Veículo:**
   * Conferir a carga física na doca contra o PDF de lista de carregamento antes da saída do portão.

---

## 5. OPERAÇÃO DO MOTORISTA E GESTÃO DE OCORRÊNCIAS
O motorista opera com o aplicativo nativo `XiquimVargas-Motorista-1.8.3.apk`:

1. **Visualização das Paradas:**
   * O motorista abre o app; as entregas do dia aparecem ordenadas por prioridade viária.
2. **Comunicação Prévia:**
   * Antes de chegar ao destino, o motorista toca no ícone de **WhatsApp** ou **Telefone** para avisar o cliente em 1 clique.
3. **Entrega com Sucesso:**
   * No momento da entrega, o motorista clica em **"Anexar Comprovante"**, fotografa o canhoto assinado ou a fachada com o produto e clica em **"Concluir Entrega"**.
   * O pedido avança para `CONCLUIDO` e o estoque reservado é baixado definitivamente no servidor.
4. **Protocolo de Insucesso (Não Entregue):**
   * Se o cliente estiver ausente, estabelecimento fechado ou recusa de entrega:
   * O motorista toca em **"Registrar Retorno"**, seleciona o motivo (ex: "Cliente Ausente", "Endereço Incorreto", "Recusa") e detalha a ocorrência.
   * **Reversão Automática:** O status do pedido retorna de `ROTA` diretamente para `SEPARACAO`.
   * O pedido é desacoplado do veículo e ressurge imediatamente na Torre de Controle no painel **"Pedidos que Retornaram"**.

---

## 6. DOCA DE RECEBIMENTO (INBOUND) E ENTRADA DE FORNECEDORES
1. Ao chegar caminhão de fornecedor com mercadorias:
   * Acessar na Torre de Controle o menu **Compras / Inbound**.
   * Localizar a Ordem de Compra correspondente (`SOLICITADO` ou `CONFIRMADO`).
2. **Conferência Cega / Bipagem:**
   * Bipar os códigos de barras das caixas recebidas no campo de busca inbound (`/api/inbound/barcode`).
   * Validar as quantidades físicas entregues contra o faturamento do fornecedor.
3. **Efetivação de Entrada:**
   * Clicar em **"Confirmar Recebimento"** (`POST /api/purchases/:id/receive`).
   * O estoque é incrementado no mesmo segundo, o preço de custo é auditado no histórico (`produto_custos_historico`) e os eventos SSE de atualização de estoque disparam para todas as telas.

---

## 7. FECHAMENTO DE TURNO E CONCILIAÇÃO
Ao término do expediente diário:
1. **Fechamento dos Caixas:**
   * Realizar a sangria e fechamento nos terminais PDV, conferindo valores físicos contra o relatório do turno.
2. **Conferência de Retornos Físicos:**
   * A expedição confere fisicamente as caixas que voltaram com os motoristas, confrontando com a lista da Torre.
   * As caixas retornam para o galpão e os pedidos ficam aptos para reembarque no dia útil seguinte.
3. **Execução de Backup Operacional:**
   * O servidor executa automaticamente o backup noturno diário (`npm run backup`). O encarregado pode validar a pasta `/var/data/backups/`.

---

## 8. INSTALAÇÃO E DISTRIBUIÇÃO DOS 4 APKS NATIVOS
Os aplicativos encontram-se prontos para distribuição na pasta `/dist-apks/`:
* `XiquimVargas-Vendedor-1.8.3.apk`
* `XiquimVargas-Motorista-1.8.3.apk`
* `XiquimVargas-PDV-1.8.3.apk` / `XiquimVargas-Caixa-1.8.3.apk`
* `XiquimVargas-TorreControle-1.8.3.apk`

### 8.1 Passo a Passo de Instalação no Celular Android:
1. Enviar o arquivo APK para o celular do colaborador (via WhatsApp, e-mail, cabo USB ou download direto).
2. Tocar no arquivo e autorizar a opção "Permitir desta fonte" (Fontes Desconhecidas).
3. Concluir a instalação e abrir o app.
4. O aplicativo já abre instantaneamente na tela de trabalho com o logotipo oficial HD, sem precisar de configuração adicional de servidor ou digitação de URL.
