# AUTONOMIA SYSTEMS — MATRIZ DE ACESSOS E RESPONSABILIDADES
**Governança de Perfis, Controle Granular de Permissões e Matriz RACI**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Data:** Outubro de 2026

---

## 1. MAPEAMENTO DE PERFIS E APLICATIVOS DEDICADOS

| Papel Operacional | Interface / Aplicativo Dedicado | Escopo de Acesso e Permissões |
| :--- | :--- | :--- |
| **Administrador / Diretor** | Torre de Controle (`XiquimVargas-TorreControle-1.8.3.apk` / `admin.html`) | Acesso irrestrito a todos os módulos, relatórios gerenciais, cadastros e parametrizações. |
| **Vendedor Externo** | App do Vendedor (`XiquimVargas-Vendedor-1.8.3.apk` / `vendedor.html`) | Consulta de catálogo com 626 produtos, emissão de pedidos para clientes de sua carteira. |
| **Operador de Caixa (PDV)** | App do PDV (`XiquimVargas-PDV-1.8.3.apk` / `pdv.html`) | Venda expressa no balcão, leitor de código de barras, recebimento e emissão de comprovantes. |
| **Motorista de Entregas** | App do Motorista (`XiquimVargas-Motorista-1.8.3.apk` / `motorista.html`) | Visualização das rotas atribuídas, contato com clientes via WhatsApp, registro de ocorrências. |
| **Expedição e Estoquista** | Torre de Controle - Módulo Logística e Estoque | Separação física de mercadorias, conferência de doca (inbound) e despacho de rotas. |
| **Cliente Web (B2B/B2C)** | Loja Online E-Commerce (`loja.html`) | Autoatendimento para consulta de catálogo e emissão de pedidos de compra digitais. |
