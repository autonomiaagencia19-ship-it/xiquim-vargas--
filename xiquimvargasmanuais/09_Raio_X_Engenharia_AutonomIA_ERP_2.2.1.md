# RAIO-X DE ENGENHARIA COMPLETO — ERP AUTONOMIA (XIQUIM VARGAS)
**Versão do Sistema:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3 (100% Offline)  
**Ambiente Oficial:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. TOPOLOGIA DE SISTEMAS E ARQUITETURA DE CLIENTES

```mermaid
graph TD
    subgraph Apresentacao_e_Clientes [Camada de Apresentação e Clientes]
        direction TB
        TW[Torre de Controle Web / PWA Admin]
        LO[Loja Online E-Commerce / Web]
        PDV_WEB[Frente de Caixa Balcão / PDV Web]
        
        subgraph APKs_Android_Nativos_Offline [4 APKs Nativos Kotlin - 100% Offline]
            APK_TW[XiquimVargas-TorreControle-1.8.3.apk]
            APK_VEND[XiquimVargas-Vendedor-1.8.3.apk]
            APK_MOT[XiquimVargas-Motorista-1.8.3.apk]
            APK_PDV[XiquimVargas-PDV-1.8.3.apk]
        end
    end

    subgraph Borda_e_API [Borda HTTP e Sincronização]
        GW[Node.js 22+ HTTP Server / server.js]
        SSE_POOL[Pool de Conexões SSE / broadcastEvent]
    end

    subgraph Modulos_Centrais [Módulos Centrais de Negócio]
        MOD_DB[db.js - SQLite WAL Engine]
        MOD_ROUT[routing.js - Roteirização Geoespacial]
        MOD_AI[ai.js - Groq Administrative AI ReadOnly]
        MOD_PDF[pdf.js - Motor Vetorial PDF Puro]
    end

    subgraph Persistencia_Render [Persistência em Disco /var/data]
        SQLITE[(xiquim-vargas.db / 626 SKUs / 100k un)]
        MEDIA[Mídias: proofs / product-images]
    end

    TW & LO & PDV_WEB -->|HTTP/REST & SSE| GW
    APK_TW & APK_VEND & APK_MOT & APK_PDV -->|100% Offline Local + Sync REST| GW
    GW --> SSE_POOL
    GW --> MOD_DB & MOD_ROUT & MOD_AI & MOD_PDF
    MOD_DB --> SQLITE
    MOD_PDF --> MEDIA
```

### 1.1 Invariantes de Engenharia Atendidos
* **Abertura 100% Offline dos APKs:** Implementação de `shouldInterceptRequest` servindo arquivos embutidos de `assets/www/` em ~0.05s sem requerer conectividade.
* **URL Oficial Fixa:** `https://xiquim-vargas-erp.onrender.com` pré-configurada nos APKs e no servidor.
* **Ícone Oficial HD:** `01_Logo_Xiquim_Vargas_HD.png` aplicado nos 4 apps nativos.
* **Base de Inauguração:** 626 SKUs ativos, 100.000 unidades em estoque por produto, zero pedidos fictícios de teste.
* **Identidade Visual Vendedor:** Subtítulos no tom institucional Laranja (`#FD5E02`) e cache PWA v1.8.12.
