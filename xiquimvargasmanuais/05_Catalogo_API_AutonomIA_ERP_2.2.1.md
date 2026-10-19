# AUTONOMIA SYSTEMS — CATÁLOGO DE API REST
**Famílias de Endpoints, Contratos REST, Eventos em Tempo Real e Integração**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Base URL:** https://xiquim-vargas-erp.onrender.com  
**Data:** Outubro de 2026

---

## 1. PADRÕES DA API REST E SEGURANÇA
A API do ERP opera com protocolo RESTful e streaming de eventos:
* **URL Base de Produção:** `https://xiquim-vargas-erp.onrender.com`
* **Autenticação:** Header `Authorization: Bearer <JWT_TOKEN>`
* **Fallback para APKs Locais:** Quando executado a partir do protocolo `file://` nos APKs offline, chamadas que requerem sincronização utilizam o fallback autoritativo para o Render.
* **Formato de Payload:** `application/json` com sanitização contra injeção e XSS.

---

## 2. FAMÍLIAS DE ENDPOINTS PRINCIPAIS
* **Autenticação e Sessão:** `POST /api/login`, `GET /api/me`, `POST /api/logout`.
* **Catálogo e Produtos:** `GET /api/products`, `POST /api/products`, `PUT /api/products/:id`.
* **Estoque e Inventário:** `GET /api/stock`, `POST /api/stock/adjust`, `GET /api/stock/ledger`.
* **Pedidos e Vendas:** `GET /api/orders`, `POST /api/orders`, `POST /api/orders/:id/status`.
* **PDV e Balcão:** `POST /api/pdv/orders`, `GET /api/pdv/history`.
* **Logística e Rotas:** `GET /api/routes`, `POST /api/routes`, `POST /api/routes/:id/dispatch`.
* **Reversão de Insucesso Logístico:** `POST /api/logistics/orders/:oid/fail` (reverte pedido para separação e emite alerta na Torre).
* **Streaming de Eventos:** `POST /api/events/ticket`, `GET /api/events` (Server-Sent Events com heartbeat a cada 25s).
