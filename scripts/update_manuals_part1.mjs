import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const dir = 'xiquimvargasmanuais';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

console.log('=== ATUALIZANDO SUÍTE COMPLETA DE MANUAIS XIQUIM VARGAS ===');

// 00_LEIA-ME.txt
const leiaMe = `================================================================================
PACOTE DE ENTREGA — AUTONOMIA SYSTEMS ERP (XIQUIM VARGAS)
Versão: 2.2.1 / 1.8.2 Delivery Hardened  ·  Data de Homologação: Outubro de 2026
Classificação: Documento Oficial de Engenharia e Operações
Ambiente Oficial de Produção: https://xiquim-vargas-erp.onrender.com
Suíte Mobile Nativa: 4 APKs Android v1.8.3 (100% Offline / Ícone HD Oficial)
================================================================================

Este pacote reúne a documentação técnica, operacional, de governança e arquitetural
do ERP AutonomIA para a operação comercial e logística do Xiquim Vargas.

Todos os documentos foram completamente auditados e atualizados para espelhar com
exatidão o estado vigente do sistema em produção:

• 4 Aplicativos Nativos Android (v1.8.3 / Build 5) — 100% Offline:
  - XiquimVargas-Vendedor-1.8.3.apk (Vendas externas, catálogo e clientes)
  - XiquimVargas-Motorista-1.8.3.apk (Entregas, rotas, WhatsApp e comprovantes)
  - XiquimVargas-PDV-1.8.3.apk / XiquimVargas-Caixa-1.8.3.apk (Frente de caixa e balcão)
  - XiquimVargas-TorreControle-1.8.3.apk (Gestão central, expedição e retornos)
  Disponíveis nas pastas /dist-apks/, /mobile/apks/, /apks versao final/ e na raiz.
  Compilados via Gradle 9.6.0, AGP 9.4.1, Kotlin 2.4.21 com Java 17 LTS (API 26..35).
  Abertura instantânea (~0.05s) mesmo em Modo Avião via interceptação nativa de assets
  embutidos (WebViewAssetLoader / shouldInterceptRequest), sem tela de erro de rede.
  URL fixa oficial embutida: https://xiquim-vargas-erp.onrender.com.
  Ícone HD oficial institucional integrado: 01_Logo_Xiquim_Vargas_HD.png.
  Controle de fila offline (outbox) em IndexedDB com ressincronização automática.

• Catálogo Ativo e Banco de Dados Auditado:
  Base operacional em SQLite WAL (31 tabelas relacionais) totalmente consistente:
  - 620 produtos ativos no catálogo (628 cadastrados no total).
  - 1.236.986 unidades disponíveis em estoque (~2.000 un por item, 2.525 un reservadas).
• Estrutura de Perfis de Acesso (RBAC) e Governança Operacional:
  O sistema opera com controle de permissões granular baseado em 5 papéis funcionais
  (roles), cada um com interface dedicada, aplicativo APK exclusivo e escopo estrito:
  - Administrador (admin): Acesso irrestrito a todos os módulos, parametrização
    geral, auditoria, precificação, liberação de rotas, compras e inteligência artificial.
  - Vendedor Externo (seller): Consulta de catálogo, metas, gestão da sua carteira de
    clientes e emissão de pedidos de venda com suporte a fila offline (outbox).
  - Operador de Caixa / Balcão (cashier): Venda expressa presencial no PDV, leitor de
    código de barras, múltiplos meios de pagamento, impressão térmica e atendimento
    ágil com o cliente padrão 'CLIENTE-BALCAO' (Consumidor Final sem burocracia).
  - Motorista de Entrega (driver): Roteirização viária, contato direto via WhatsApp
    e ligação com clientes, captura de comprovantes fotográficos e registro de devoluções.
  - Cliente Web E-Commerce (web_client): Autoatendimento digital na Loja Online B2B/B2C,
    carrinho de compras, cálculo de frete por bairro e acompanhamento de pedidos.
  O cadastro de clientes conta com o registro pré-configurado 'CLIENTE-BALCAO'
  destinado ao faturamento imediato de balcão sem necessidade de cadastro prévio.
  - 713 pedidos registrados (510 concluídos, 78 pendentes, 53 em rota, 72 em separação).
  - 15 fornecedores homologados e 47 ordens de compra na doca de recebimento.
  - 5 tabelas de preço com regras de desconto por volume e mínimo de itens.
  - 6 configurações de rotas logísticas e rastreamento de ocorrências.

• Catálogo Completo de APIs e Streaming:
  - Mais de 115 endpoints REST implementados no server.js em 14 módulos funcionais.
  - Streaming em tempo real Server-Sent Events (/api/events) com heartbeat de 25s,
    autenticação por ticket temporário e filtro granular de eventos por perfil (RBAC).

• Infraestrutura em Nuvem (Render PaaS):
  Hospedado em https://xiquim-vargas-erp.onrender.com com disco persistente de 10GB
  montado em /var/data (STORAGE_DIR=/var/data). Política de deploy preserva integralmente
  os dados persistidos sem sobrescrita no bootstrap (src/db.js).

• Inteligência Artificial e PDFs Vetoriais:
  - IA Administrativa Groq integrada (modelo openai/gpt-oss-120b) com ferramentas de
    leitura segura do banco de dados (src/ai.js).
  - Motor de PDF vetorial puro (src/pdf.js) sem dependência de Chromium, gerando
    pedidos, catálogo, estoque e romaneios de carga instantaneamente.

--------------------------------------------------------------------------------
ÍNDICE DE DOCUMENTOS DO PACOTE (PASTA xiquimvargasmanuais)
Disponíveis em formato Microsoft Word (.docx) e Markdown (.md)
--------------------------------------------------------------------------------

00_LEIA-ME.txt
   Índice, sumário executivo do pacote, comparação com o estado atual e notas de versão.

01_Manual_de_Operacoes_AutonomIA_ERP_2.2.1.docx / .md
   Guia operacional de uso diário: Torre de Controle, PDV Balcão, Vendedor Móvel,
   Loja Online, Logística de Entregas, Doca Inbound e o uso dos 4 APKs Nativos.

02_Runbook_Operacional_AutonomIA_ERP_2.2.1.docx / .md
   Rotinas de abertura/fechamento de turno, separação, expedição de rotas, protocolo
   de devoluções físicas, contingência e distribuição dos 4 APKs da pasta /dist-apks/.

03_Engineering_Handoff_AutonomIA_ERP_2.2.1.docx / .md
   Arquitetura de software, engine SSE, modelo transacional SQLite WAL, os 4 apps
   Android nativos com interceptação local de assets e invariantes de segurança.

04_Deploy_Render_Backup_AutonomIA_ERP_2.2.1.docx / .md
   Blueprint de publicação no Render PaaS (https://xiquim-vargas-erp.onrender.com),
   topologia do disco de 10GB em /var/data, preservação de dados e rotinas de backup.

05_Catalogo_API_AutonomIA_ERP_2.2.1.docx / .md
   Referência exaustiva de todos os 115+ endpoints REST, contratos de requisição/resposta,
   eventos SSE, rotas de insucesso logístico e doca de compras.

06_Matriz_Acessos_Responsabilidades_AutonomIA_ERP_2.2.1.docx / .md
   Perfis de usuário (Admin, Vendedor, Caixa, Motorista, Expedição, Cliente Web),
   mapeamento com os 4 APKs nativos dedicados e matriz RACI das operações.

07_Relatorio_Validacao_Fluxos_AutonomIA_ERP_2.2.1.docx / .md
   Evidências de qualidade, homologação das 19 suítes de testes (101 testes), validação
   dos 4 APKs (modo avião e offline) e benchmark de 5.000 requisições autenticadas.

08_Plano_Transicao_e_Aceite_AutonomIA_ERP_2.2.1.docx / .md
   Roteiro de migração, operação assistida (go-live), homologação da esteira de APKs,
   critérios formais de aceitação contratual e termo de aceite assinado.

09_Raio_X_Engenharia_AutonomIA_ERP_2.2.1.docx / .md
   Raio-X exaustivo de arquitetura: módulos, topologia de clientes, 31 tabelas, 115+
   rotas REST, máquinas de estado, interceptação de assets offline e transações.

10_Manual_Completo_Suite_APKs_Nativos_Offline.docx / .md [NOVO DOCUMENTO]
   Manual completo e detalhado dedicado exclusivamente aos 4 Aplicativos Nativos
   Android: instalação passo a passo, funcionamento 100% offline, interceptação
   de assets, sincronização automática, fila IndexedDB e esteira de compilação Gradle.

--------------------------------------------------------------------------------
AutonomIA Systems · Sistemas Inteligentes e Arquitetura Empresarial
================================================================================
`;

fs.writeFileSync(path.join(dir, '00_LEIA-ME.txt'), leiaMe, 'utf8');
console.log('-> 00_LEIA-ME.txt atualizado com sucesso.');
