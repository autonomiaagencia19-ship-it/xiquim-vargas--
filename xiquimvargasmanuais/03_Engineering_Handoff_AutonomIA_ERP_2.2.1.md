# AUTONOMIA SYSTEMS — ENGINEERING HANDOFF
**Arquitetura de Software, Componentes Técnicos, Invariantes e Sustentação de Engenharia**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3  
**Produção:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. ARQUITETURA GERAL E PILARES TÉCNICOS
O ERP AutonomIA foi projetado sob o padrão de **alta eficiência, zero-bloat runtime, segurança transacional estrita e latência sub-milissegundo**:

* **Backend Runtime:** Node.js 22 LTS em ESM nativo (`import/export`), sem intermediários como Express ou frameworks pesados. O servidor HTTP nativo (`server.js`) entrega rotas REST e streaming em tempo real com consumo mínimo de memória RAM (~65MB em repouso).
* **Camada de Dados Transacional:** SQLite nativo (`node:sqlite` - `DatabaseSync`) operando com `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON` e `PRAGMA busy_timeout=5000`. Todas as mutações multi-entidade são empacotadas na função transacional `tx(() => { ... })`, assegurando isolamento ACID absoluto.
* **Camada de Apresentação:** Vanilla HTML5, CSS3 moderno e JavaScript ES6+ modular (`app.js` e `role.js`). Zero tempo de compilação no deploy e renderização instantânea no navegador.
* **Barramento em Tempo Real:** Motor Server-Sent Events (SSE) nativo (`/api/events`) com autenticação via ticket criptográfico, heartbeat a cada 25 segundos e controle de vazamento de memória (máximo de 3 conexões simultâneas por usuário).
* **Motor de PDF Vetorial Puro:** Implementação em JavaScript puro (`src/pdf.js`) que constrói documentos PDF vetoriais em milissegundos sem necessidade de instâncias pesadas de Chromium ou bibliotecas binárias externas.
* **Inteligência Artificial Administrativa:** Módulo `src/ai.js` conectado à API Groq (modelo `openai/gpt-oss-120b`) com ferramentas estritas de leitura parametrizada do banco de dados para assistência analítica executiva.

---

## 2. ARQUITETURA MOBILE DOS 4 APKS NATIVOS (100% OFFLINE)
A suíte mobile nativa localiza-se no diretório `mobile/`:
* `mobile/seller-native` (Vendedor Externo)
* `mobile/driver-native` (Motorista de Entregas)
* `mobile/pdv-native` (Frente de Caixa e Balcão)
* `mobile/tower-native` (Torre de Controle Móvel)

### 2.1 Mecanismo de Interceptação Local de Assets
Cada aplicativo Android implementa no `MainActivity.kt` o interceptador de requisições de rede:
```kotlin
webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        val uri = request?.url ?: return null
        return interceptAsset(uri) ?: super.shouldInterceptRequest(view, request)
    }
}
```
* **Mapeamento de Assets:** A função `interceptAsset` mapeia rotas estáticas para a pasta interna `app/src/main/assets/www/`.
* **Desempenho Offline:** Caso o celular esteja sem sinal ou em Modo Avião, o WebView carrega os scripts, estilos e interfaces HTML locais em menos de 0.05s, sem emitir `ERR_NAME_NOT_RESOLVED`.
* **Ponte Nativa (`AndroidAppBridge`):** O aplicativo expõe interfaces nativas para o JavaScript:
  - `AndroidApp.openPdf(url, filename)`: Abre documentos PDF no visualizador nativo do Android.
  - `AndroidApp.printWebPage()`: Aciona a fila de impressão térmica nativa do sistema operacional.
  - `AndroidApp.getBaseUrl()`: Retorna a URL base do servidor ERP (`https://xiquim-vargas-erp.onrender.com`).
  - `AndroidApp.getRole()`: Retorna o papel operacional fixo do aplicativo (`seller`, `driver`, `cashier`, `admin`).
  - `AndroidApp.getAppVersion()`: Retorna a versão de compilação (`1.8.3`).

### 2.2 Monitoramento Dinâmico de Rede
`MainActivity.kt` registra um callback contínuo (`ConnectivityManager.NetworkCallback`). Quando a conectividade é reestabelecida, o app comuta automaticamente `cacheMode = WebSettings.LOAD_DEFAULT` e dispara o evento JavaScript `window.dispatchEvent(new Event('online'))`, disparando `syncOfflineQueue()` para enviar vendas e comprovantes pendentes.

---

## 3. SEGURANÇA E INVARIANTES DE ENGENHARIA
1. **Armazenamento de Senhas:** Hashing criptográfico `scrypt` com salt pseudoaleatório de 16 bytes e derivação de chave de 64 bytes (`scrypt$salt$hash`). Senhas nunca são salvas em texto claro.
2. **Tokens JWT:** Assinatura HMAC-SHA256 com segredo persistente (`JWT_SECRET`), tempo de expiração de 30 dias (2.592.000 segundos) e sanitização estrita de payload.
3. **Proteção Contra Força Bruta e DoS:**
   - Limite de 20 tentativas de login por IP a cada 60 segundos (`LOGIN_MAX = 20`).
   - Limite de 600 requisições gerais por IP a cada 60 segundos (`API_MAX = 600`).
4. **Precisão Financeira em Centavos:** Cálculos de pedidos, itens e descontos são operados em centavos inteiros antes da gravação no banco de dados, prevenindo imprecisões de ponto flutuante IEEE 754.
5. **Auditoria Contínua:** Todas as mutações de pedidos, estoque, preços, clientes, rotas e compras geram registros imediatos na tabela `audit_logs`.
