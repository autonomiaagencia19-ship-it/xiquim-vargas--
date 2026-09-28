# Xiquim Vargas ERP

Versão visual: **1.4.0 — Brand Identity Update**

ERP operacional da Xiquim Vargas com SQLite, cinco interfaces, RBAC, estoque transacional, pedidos, PDF, logística e Torre de Controle.

## Interfaces

- `/admin.html` — Torre de Controle
- `/loja.html` — Loja Online
- `/vendedor.html` — Vendedor Externo
- `/pdv.html` — Frente de Loja / PDV
- `/motorista.html` — Logística / Motorista

## Identidade visual

A interface foi atualizada com base nas referências visuais fornecidas para a marca. Os assets extraídos ficam em `public/assets/brand/` e a especificação está em `docs/BRAND_IMPLEMENTATION.md`.

## Execução

```bash
npm install
npm start
```

Servidor padrão: `http://localhost:3000`.

## Documentação

Comece por:

1. `docs/MASTER_PLAN.md`
2. `docs/ENGINEERING_HANDOFF.md`
3. `docs/RUNBOOK.md`
4. `docs/BRAND_IMPLEMENTATION.md`
5. `docs/RELEASE_1.4.0_BRAND.md`

## Banco

SQLite permanece como banco transacional oficial desta entrega.

## Segurança

Não há fallback de senha no backend. O segredo JWT de produção deve ser configurado por variável de ambiente.


## Release 1.7.0

Catálogo e Estoque Inteligente agora são domínios independentes; fotos e promoções são administráveis pela Torre; Loja Online possui carrinho; vendedor possui consulta de estoque; motorista prioriza câmera para canhoto; PDFs de catálogo/estoque e pedidos possuem download autenticado. Consulte `docs/RELEASE_1.7.0_OPERATIONAL_REFINEMENT.md` e `docs/RUNBOOK_1.7.0_MANUTENCAO.md`.
