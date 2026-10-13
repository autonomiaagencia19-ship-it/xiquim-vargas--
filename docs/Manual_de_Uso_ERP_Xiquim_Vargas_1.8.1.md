# Manual Completo de Uso do ERP Xiquim Vargas (v1.8.1)
**Criado e Revisado por: Autonomia**

Este documento é o guia definitivo para todas as áreas da empresa: desde a gerência (usando a Torre de Controle) até os funcionários da rua (Motoristas e Vendedores). Nós escrevemos sem jargões difíceis para que você possa imprimir e entregar na mão da sua equipe como um manual de treinamento oficial.

---

## PARTE 1: A Torre de Controle (O Coração da Empresa)
A Torre de Controle é o seu painel de comando. Ela pode ser acessada pelo Navegador do seu Computador (clicando no link do sistema) ou pelo aplicativo "Torre" no celular do gerente.

### 1.1 Painel de Vendas (Dashboard)
Assim que você entra, o sistema mostra o coração batendo:
*   **Cards no topo:** Faturamento total do dia, total de pedidos fechados, quantos clientes estão na base.
*   **Funil Operacional:** Você enxerga exatamente quantos pedidos estão "Pendentes", "Em Separação", "Na Rota do Motorista" e "Concluídos". 
*   **Top Produtos:** Um ranking automático dizendo o que está vendendo mais e gerando mais dinheiro.
*   **Origem das Vendas:** Um comparativo visual para você saber quem está vendendo mais: O Vendedor da Rua, o Frente de Loja (PDV) ou a sua Loja Online.

### 1.2 Tabelas de Preço (O Segredo do Atacado)
Você não precisa mais quebrar a cabeça mudando os preços de cada cliente. 
1. Vá no menu esquerdo e clique em **Tabelas de Preço**.
2. Clique em "Nova Tabela" (exemplo: *Tabela Supermercados*).
3. Dentro dessa tabela, você escolhe produtos específicos e abaixa o preço deles.
4. Depois, vá na aba **Clientes**, pegue o cadastro dos supermercados e vincule a eles essa Tabela.
*Mágica:* Quando o seu vendedor visitar o supermercado, o celular dele vai aplicar o preço promocional sozinho, sem o vendedor precisar digitar descontos manuais!

### 1.3 Gestão de Estoque
Dentro de **Estoque Inteligente**, você tem uma barra de vida para cada produto.
*   *Quantidade Disponível:* O que você de fato tem para vender.
*   *Em Separação:* Se um vendedor fechar um pedido na rua agora, o sistema automaticamente "tranca" essas unidades em separação, impedindo que outro vendedor venda o mesmo item e zere a sua prateleira sem você saber.

### 1.4 A Logística (Montando os Caminhões)
1. Clique na aba **Logística**. Você verá todos os pedidos que os vendedores enviaram e que o seu estoque já separou.
2. Clique em "Nova Rota". Escolha o nome do Motorista.
3. Arraste e solte os pedidos que vão para a caçamba dele na ordem exata que ele deve fazer as entregas (Roteirização).
4. Assim que salvar, o celular do motorista irá apitar com o caminho pronto!

### 1.6 O Que Acontece Se a Torre Ficar Sem Internet?
Diferente de sites comuns que caem e apagam tudo, o seu app da Torre de Controle tem um "Modo Escondido de Sobrevivência". 
Se o Wi-Fi oscilar enquanto você estiver arrastando uma rota:
- A tela não vai sair do ar. Ela vai puxar a memória do celular e mostrar a mensagem *"Conexão instável. Exibindo dados locais"*.
- Se você salvar a rota sem internet, ele vai avisar *"Ação Salva"* e vai ficar segurando a informação. Na hora que o 4G voltar, a sua Torre manda tudo para o servidor sozinha!

---

## PARTE 2: Os Braços da Operação (Os Aplicativos Nativos)

### 2.1 O Aplicativo do Vendedor Externo (`seller-native`)
O Vendedor pode ir para a fazenda mais isolada do Brasil. O aplicativo é **100% Offline**.
*   **No começo do dia (Com internet):** Ele abre o app, clica em "Atualizar", e o aplicativo chupa todo o estoque, clientes e preços mais novos para a memória do aparelho.
*   **No Cliente (Sem internet):** Ele clica em "Novo Pedido", adiciona os itens (mesmo sem sinal), preenche a quantidade, vê o valor total e aperta salvar. O pedido fica com um ícone de um reloginho (Pendente).
*   **Fim do dia (Com internet):** O aplicativo sozinho descarrega tudo para a nuvem da empresa.

### 2.2 O Aplicativo do Motorista (`driver-native`)
O foco do motorista não é vender, é entregar.
*   A tela dele é uma "Fila do Dia" gigante. Mostra: *Parada 1, Parada 2, Parada 3*.
*   Ele tem um botão **Abrir Maps** que joga o endereço do cliente direto pro Google Maps.
*   Quando ele chega no local, ele clica em **📷 Canhoto**, tira uma foto do papel assinado e aperta Concluído. A foto vai direto para a tela do Administrador na aba de Pedidos, comprovando a entrega!

### 2.3 O Aplicativo Frente de Caixa / Balcão (`pdv-native`)
Fica instalado no tablet ou celular de quem fica na sua loja física. Ele é igual ao do vendedor, mas focado num fluxo rápido. No fim do dia, todos os relatórios do sistema vão separar perfeitamente quanto dinheiro entrou pelos Vendedores de Rua e quanto dinheiro entrou pelo Balcão (PDV).

---

## PARTE 3: Backup Automático (A Sua Garantia)
Para sua tranquilidade, você não precisa confiar apenas na nuvem. Você pode configurar o seu Notebook (ou o computador de casa) para puxar um clone do sistema inteiro todos os dias. O desenvolvedor configurou uma tarefa no seu computador chamada "Agendador de Tarefas" (Task Scheduler). Todo dia em um horário marcado, o computador faz um download escondido, zipa todos os pedidos e fotos num pacote e salva na sua pasta de Meus Documentos. Se o mundo acabar, seu sistema inteiro está guardado fisicamente com você!
