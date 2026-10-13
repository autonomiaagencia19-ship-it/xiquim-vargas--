# Handoff de Engenharia - Arquitetura e Mobile (Xiquim Vargas ERP v1.8.1)

## 1. Visão Arquitetural Sistêmica

O Xiquim Vargas ERP evoluiu para a versão 1.8.1 adotando uma infraestrutura monolítica moderna no backend, suportada por um banco de dados leve e de altíssima performance, e pulverizada na ponta através de 4 frentes nativas Android.

O objetivo do ecossistema é centralizar os dados no servidor, mas delegar o processamento e a sobrevivência operacional aos dispositivos locais caso haja interrupção de conectividade.

### 1.1 Diagrama de Componentes

```mermaid
graph TD
    subgraph Nuvem Render (PaaS)
        Node[Node.js API - Express.js]
        SQL[(SQLite WAL Mode)]
        Static[Arquivos Estáticos & PWA]
        Uploads[Disco Persistente - Imagens/Canhotos]
        
        Node --> SQL
        Node --> Uploads
        Static --> Node
    end

    subgraph Força de Rua (Offline-First Kotlin)
        Seller[Vendedor - seller-native]
        Driver[Motorista - driver-native]
        PDV[Frente de Caixa - pdv-native]
        
        Seller <--> |Sincronia Assíncrona| Node
        Driver <--> |Sincronia Assíncrona| Node
        PDV <--> |Sincronia Assíncrona| Node
    end

    subgraph Gestão (Online / Tolerante a Falha)
        TorreWeb[Acesso Web Desktop]
        TorreApp[Torre App - tower-native WebView]
        
        TorreWeb <--> |HTTPS/REST| Node
        TorreApp <--> |Cache / WebView Bridge| Node
    end
```

---

## 2. A Camada de Backend (Node.js e SQLite)

O núcleo (Core) da aplicação roda sem a necessidade de ORMs pesados. As consultas SQL são redigidas nativamente garantindo que a complexidade do negócio (como cálculo de preço final baseado em tabelas de atacado) seja resolvida rapidamente.

*   **Motor:** Node.js v22.5.0+ utilizando o módulo embutido `node:sqlite`.
*   **Performance:** `PRAGMA journal_mode = WAL` (Write-Ahead Logging) está ativado, permitindo leituras simultâneas à gravação sem bloqueio do banco.
*   **Camada de Rotas:** Organizadas logicamente em domínios (`auth`, `users`, `products`, `orders`, `logistics`, `prices`).
*   **Autenticação:** Baseada em JWT (JSON Web Tokens) transportada via `Authorization: Bearer`.
*   **Idempotência:** Requisições críticas (como `POST /api/orders`) exigem um header `Idempotency-Key` (normalmente atrelado ao UUID gerado no aplicativo offline). Se o aplicativo perder a rede no exato momento da resposta e tentar re-enviar o pedido, o servidor ignora o segundo e retorna o payload do primeiro, evitando duplicatas financeiras.

---

## 3. Os Aplicativos Android Nativos (Código-Fonte `mobile/`)

O diretório `mobile/` abriga os quatro APKs independentes. Os módulos de força de rua compartilham a mesma espinha dorsal de engenharia:

### 3.1 Arquitetura Offline-First (`seller-native`, `driver-native`, `pdv-native`)
Estes apps não renderizam HTML, são escritos de forma programática em Kotlin manipulando Views (LinearLayouts, Buttons, EditTexts).

1.  **O Coração do Offline (`LocalDb.kt`):** Uma classe wrapper de `SQLiteOpenHelper`. Durante a conexão ativa, o aplicativo varre o backend e baixa toda a base de produtos, tabelas de preço, rotas e clientes.
2.  **O Ciclo de Sincronização (`sync()`):** Chamado no `MainActivity.kt` ou em Threads de retaguarda. Se falhar, a variável `offline = true` é cravada, e o app carrega o cache do `LocalDb`.
3.  **A Fila de Envio (`Outbox`):** Quando o Vendedor cria um pedido, a submissão não é direta. O pedido ganha o status de `PENDING` na tabela `orders` local, e um payload de requisição é gravado no banco local. A rotina `syncOutbox()` entra em loop tentando disparar isso para o backend até receber `HTTP 200`.

### 3.2 O Aplicativo da Torre de Controle (`tower-native`)
O módulo da Torre não utiliza `LocalDb.kt` nativo. Ele foi projetado usando um padrão `WebViewWrapper` sofisticado:
1.  O aplicativo inicia a `MainActivity` instanciando um WebEngine que engole a URL `/admin.html`.
2.  **Interceptação Neural:** No lado web (`public/app.js`), a função `api()` foi sobrescrita para atuar como um *Service Worker Lógico*.
3.  Se a requisição for um GET e falhar por queda de rádio, o JS puxa do `localStorage`.
4.  Se for uma alteração (POST/PUT), o JS enfileira no `xv_outbox` do cache de navegador do celular e disfarça um HTTP 200 (Successo Fantasma) para a interface do admin não travar. Ao detectar a subida do rádio (`window.online`), a fila é drenada para o servidor.

---

## 4. Funcionalidades Core (Regras de Negócio Implementadas)

### Tabelas de Preço (Pricing Engine)
O cálculo do preço de um produto não é estático.
- Tabela `price_tables`: Define o nome da modalidade (ex: Atacado).
- Tabela `price_table_items`: Define o preço sobreposto de um Produto X nesta tabela.
- Na hora do faturamento (`POST /api/orders`), o servidor analisa o cliente do pedido. Se o cliente tiver um `tabela_preco_id` associado, o backend sobrepõe o preço padrão do produto pelo preço da tabela com segurança criptográfica, ignorando qualquer manipulação enviada pelo celular do vendedor.

### Logística e Ordem de Parada
Pedidos possuem status transicionais: `PENDENTE` -> `SEPARACAO` -> `ROTA` -> `CONCLUIDO`.
- Quando em `ROTA`, eles são vinculados a um ID de Logística (`route_id`).
- Um JSON no servidor (`sequencia_json`) array guarda a ordem matemática `[pedido_7, pedido_3, pedido_9]` definida pelo Drag & Drop no painel. O `driver-native` consome essa array para renderizar as paradas estritamente na ordem.

---

## 5. Instruções de Empacotamento e CI/CD

Os APKs não utilizam frameworks multiplataforma (como React Native ou Flutter). Para gerá-los:

1.  Assegure-se de que a máquina possui o JDK 17+ e o Android SDK versão 35 (VanillaIceCream).
2.  Acesse a pasta `mobile/`.
3.  Os sub-projetos são geridos pelo `settings.gradle` raiz.
4.  Execute a task de Gradle: `./gradlew assembleDebug` (ou `assembleRelease` fornecendo a Keystore de assinatura da empresa).
5.  A variável `API_BASE_URL` pode ser injetada no `build.gradle` ou preenchida diretamente pelo vendedor na primeira tela de configuração do app nativo.
