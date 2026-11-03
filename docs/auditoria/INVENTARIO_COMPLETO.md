# INVENTÁRIO COMPLETO E ESTRUTURA DO PROJETO

**Instituição Master:** AutonomIA Systems  
**Designação Comercial:** Sistema de Gestão para Empresas  
**Identidade Operacional Específica:** Distribuidora Xiquim Vargas  
**Ambiente de Produção Conhecido:** Render Cloud (`https://xiquim-vargas-erp.onrender.com` com persistência em `/var/data`)  
**Data da Auditoria:** 02/11/2026  

---

## 1. TOPOLOGIA DE DIRETÓRIOS E COMPONENTES

```
APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/
├── server.js                   # Servidor HTTP nativo Node.js 22+ (sem dependência de Express)
├── package.json                # Metadados e dependências (better-sqlite3 / node:sqlite nativo)
├── render.yaml                 # Configuração de deploy em produção com disco de 10GB montado
├── src/                        # Núcleo modular de lógica de negócio e persistência
│   ├── auth.js                 # Autenticação JWT, HMAC-SHA256 e PBKDF2/Bcrypt
│   ├── db.js                   # Engine SQLite WAL, migrações e auditoria imutável SHA-256
│   ├── security.js             # Sanitização de entradas, proteção contra injeções
│   ├── routing.js              # Roteirização multi-camada (OSRM, Google Maps e Euclidiano)
│   ├── ai.js                   # IA Administrativa Read-Only via Groq (LLaMA 3.3 / GPT-OSS)
│   ├── pdf.js                  # Motor vetorial de emissão de pedidos, catálogos e romaneios
│   └── setup.js                # Bootstrap e assistente de instalação inicial
├── public/                     # Camada de apresentação SPA (Vanilla JS + CSS puro)
│   ├── admin.html / app.js     # Torre de Controle (Painel do Administrador / Gestor)
│   ├── loja.html               # Loja Online E-commerce B2B/B2C para clientes
│   ├── vendedor.html / role.js # Portal do Vendedor Externo (com outbox offline)
│   ├── pdv.html                # Frente de Caixa Balcão / PDV Ágil
│   ├── motorista.html          # Painel de Entregas do Motorista com canhotos digitais
│   ├── sw.js                   # Service Worker para cache offline e sincronização
│   ├── styles.css              # Identidade visual unificada institucional
│   └── assets/                 # Logotipos institucionais, banners e marcas
├── mobile/                     # Suíte de 4 Aplicativos Nativos Android (Kotlin + WebView Shell)
│   ├── tower-native/           # APK Torre de Controle
│   ├── seller-native/          # APK Vendedor Externo
│   ├── pdv-native/             # APK Frente de Caixa
│   └── driver-native/          # APK Motorista de Entregas
├── storage/                    # Diretório de persistência de dados local
│   ├── xiquim-vargas.db        # Banco de dados transacional SQLite WAL (31 tabelas)
│   ├── proofs/                 # Canhotos e fotos de comprovantes de entrega
│   ├── product-images/         # Fotos dos produtos do catálogo
│   └── store-assets/           # Imagens e banners da vitrine virtual
├── cypress/                    # Testes ponta a ponta (E2E) com Cypress
│   └── e2e/
│       ├── exhaustive_all_roles_audit.cy.js # Teste exaustivo dos 5 papéis
│       ├── delivery_routes_cronograma.cy.js # Validação do módulo de rotas
│       ├── price_tables.cy.js               # Validação de tabelas de preço por volume
│       └── login.cy.js / users.cy.js        # Validação de usuários e permissões
├── scripts/                    # Scripts operacionais, automação e compilação
│   ├── build-all-apks.ps1      # Compilação dos 4 APKs nativos em Release/Debug
│   ├── sync-mobile-assets.ps1  # Sincronização de assets web para os APKs
│   ├── backup.mjs              # Rotina de backup do banco e arquivos
│   └── seed-for-cypress.mjs    # Carga de usuários para auditorias automáticas
├── docs/                       # Documentação técnica, manuais e auditorias
└── entregaveis/                # Pacote comercial e materiais de transformação
```

---

## 2. DADOS AUDITADOS NO BANCO REAL (`storage/xiquim-vargas.db`)
- **Produtos Cadastrados:** 628 produtos cadastrados com foto, SKU, código de barras e preços.
- **Clientes:** 411 clientes cadastrados (abrangendo bairros de Governador Valadares e cliente balcão).
- **Pedidos:** 713 pedidos registrados no histórico operacional.
- **Fornecedores Homologados:** 15 fornecedores com prazos de entrega configurados.
- **Ordens de Compra na Doca:** 48 ordens de reposição cadastradas.
- **Usuários Operacionais:** Administradores, vendedores externos, operadores de caixa e motoristas ativos com hash seguro PBKDF2/SHA-512.

---

## 3. IDENTIDADE E DIRETRIZES DA MARCA
- **Marca Corporativa:** **AutonomIA Systems**
- **Posicionamento:** **Sistema de Gestão para Empresas**
- **Identidade do Cliente Original:** Xiquim Vargas (preservada na base de dados, regras de negócio e contratos de API, mas parametrizável e expansível institucionalmente).

