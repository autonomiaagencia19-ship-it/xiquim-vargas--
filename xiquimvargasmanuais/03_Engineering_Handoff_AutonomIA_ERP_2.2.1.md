# AUTONOMIA SYSTEMS — ENGINEERING HANDOFF
**Arquitetura de Software, Componentes Técnicos e Sustentação de Engenharia**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3  
**Produção:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. VISÃO GERAL E PILARES ARQUITETURAIS
O ERP AutonomIA é concebido sob o paradigma de **alta disponibilidade, zero-bloat runtime e latência sub-milissegundo**:
* **Backend:** Node.js 22 LTS (ESM Nativo), sem intermediários pesados, executando em `server.js`.
* **Banco de Dados:** `node:sqlite` nativo em modo Write-Ahead Logging (`PRAGMA journal_mode=WAL`), com `PRAGMA foreign_keys=ON` e transações atômicas seguras (`src/db.js`).
* **Frontend:** Interfaces em Vanilla HTML5/CSS3/JavaScript (ES6+) com reatividade via Server-Sent Events (SSE).
* **Mobile Nativo:** 4 aplicativos Android nativos em Kotlin (API 26..34) com Gradle 9.6.0 e Java 17 LTS.

---

## 2. ARQUITETURA MOBILE DOS 4 APKS NATIVOS (100% OFFLINE)
Os 4 projetos Android localizam-se em `mobile/`:
* `mobile/seller-native`
* `mobile/driver-native`
* `mobile/pdv-native`
* `mobile/tower-native`

### 2.1 Mecanismo de Interceptação Local de Assets
Em cada aplicativo, o `MainActivity.kt` implementa a interceptação de requisições:
```kotlin
webView.webViewClient = object : WebViewClient() {
    override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
        val url = request?.url ?: return null
        return interceptAsset(url) ?: super.shouldInterceptRequest(view, request)
    }
}
```
* Se o dispositivo estiver offline (Modo Avião), a chamada para a página principal ou qualquer recurso estático (`styles.css`, `app.js`, `role.js`, imagens) é servida diretamente da pasta `app/src/main/assets/www/` do APK.
* O método legado `showOfflineScreen()` foi desativado: o aplicativo nunca mais trava com mensagens de falta de internet, abrindo em ~0.05s.
* A constante `API_BASE_URL` está definida em `build.gradle` como `"https://xiquim-vargas-erp.onrender.com"`.

---

## 3. PIPELINE DE CI/CD NO GITHUB ACTIONS
O arquivo `.github/workflows/android.yml` compila os 4 APKs na nuvem a cada push e gera os artefatos com nomes padronizados:
* `XiquimVargas-Vendedor-1.8.3.apk`
* `XiquimVargas-Motorista-1.8.3.apk`
* `XiquimVargas-PDV-1.8.3.apk`
* `XiquimVargas-TorreControle-1.8.3.apk`
