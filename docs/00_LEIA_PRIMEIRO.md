# AUTONOMIA SYSTEMS — SISTEMA DE GESTÃO PARA EMPRESAS
## Guia de Início Rápido (LEIA PRIMEIRO)

**Versão da Plataforma:** 2.2.1 | **Build Mobile:** 1.8.4  
**Data da Documentação:** Novembro de 2026  
**Classificação:** Manual Mestre de Arquitetura e Governança  

---

## 1. VISÃO GERAL DA PLATAFORMA

A plataforma **AutonomIA Systems** é um sistema completo e resiliente de gestão operacional e comercial para distribuidoras, atacadistas e empresas de comércio.

Diferente de sistemas tradicionais que travam com a oscilação da internet, o sistema opera sob o paradigma **Offline-First**:
- Vendedores na rua anotam pedidos mesmo sem sinal de celular (os pedidos ficam gravados no aparelho e sincronizam sozinhos ao voltar a rede).
- Caixas no balcão realizam faturamento contínuo mesmo com queda do link de internet da loja.
- A Torre de Controle acompanha o faturamento, expedição de mercadorias e estoque em tempo real via **Server-Sent Events (SSE)**.
- O motor de inteligência artificial embutido permite consultas rápidas ao dono do negócio em linguagem natural sem comprometer a integridade dos dados.

---

## 2. SUÍTE DE 4 APLICATIVOS ANDROID NATIVOS

Os aplicativos estão compilados e prontos para instalação direta na pasta `dist-apks/` ou na raiz do projeto:

1. **Torre de Controle (`XiquimVargas-TorreControle-1.8.4.apk`)**: Painel administrativo, Kanban de expedição, gestão de preços, clientes, compras e relatórios.
2. **Vendedor Externo (`XiquimVargas-Vendedor-1.8.4.apk`)**: Catálogo com fotos, tabela de preços por atacado/volume, carteira exclusiva de clientes e pedidos offline.
3. **Frente de Caixa / PDV (`XiquimVargas-PDV-1.8.4.apk`)**: Leitura contínua de código de barras, cálculo instantâneo de troco e impressão de comprovantes de venda.
4. **Motorista / Entregas (`XiquimVargas-Motorista-1.8.4.apk`)**: Roteiro otimizado de paradas, botão de rota GPS externa (Google Maps / Waze) e captura digital de canhoto/foto.

---

## 3. MAPA DA SUÍTE DE DOCUMENTAÇÃO TÉCNICA

Consulte os manuais específicos para cada necessidade da sua equipe:

| Documento | Assunto |
| :--- | :--- |
| [`01_VISAO_GERAL_DO_PRODUTO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/01_VISAO_GERAL_DO_PRODUTO.md) | Apresentação do produto, módulos e diferenciais de mercado. |
| [`02_ARQUITETURA_TECNICA.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/02_ARQUITETURA_TECNICA.md) | Topologia de servidores, Node.js 22+, SQLite WAL e IndexedDB. |
| [`03_INVENTARIO_DE_FUNCIONALIDADES.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/03_INVENTARIO_DE_FUNCIONALIDADES.md) | Mapeamento exaustivo de cada tela, botão e permissão de acesso. |
| [`04_MAPA_DE_APIS.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/04_MAPA_DE_APIS.md) | Catálogo completo dos endpoints REST e eventos SSE. |
| [`05_MODELO_DE_DADOS.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/05_MODELO_DE_DADOS.md) | Dicionário de tabelas, chaves primárias e relacionamentos. |
| [`06_SEGURANCA_E_PRIVACIDADE.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/06_SEGURANCA_E_PRIVACIDADE.md) | Autenticação JWT, integridade SHA-256 e LGPD. |
| [`07_INSTALACAO_E_CONFIGURACAO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/07_INSTALACAO_E_CONFIGURACAO.md) | Instalação local e publicação no Render Cloud. |
| [`08_OPERACAO_E_MANUTENCAO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/08_OPERACAO_E_MANUTENCAO.md) | Rotinas diárias, expedição, encerramento de rotas e doca. |
| [`09_BACKUP_E_RESTAURACAO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/09_BACKUP_E_RESTAURACAO.md) | Proteção de dados, snapshots do SQLite e recuperação de desastres. |
| [`10_GUIA_DE_USUARIO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/10_GUIA_DE_USUARIO.md) | Manual passo a passo para vendedores, caixas e motoristas. |
| [`11_GUIA_ADMINISTRATIVO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/11_GUIA_ADMINISTRATIVO.md) | Guia do dono: cadastro de tabelas, compras, CRM e IA. |
| [`12_GUIA_DE_IMPLANTACAO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/12_GUIA_DE_IMPLANTACAO.md) | Checklist de transição e treinamento da equipe em 5 dias. |
| [`13_TESTES_E_ACEITE.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/13_TESTES_E_ACEITE.md) | Relatório de testes de regressão e critérios de conformidade. |
| [`14_LIMITACOES_E_ROADMAP.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/14_LIMITACOES_E_ROADMAP.md) | O que o sistema faz de verdade e melhorias planejadas. |
| [`15_HISTORICO_DE_ALTERACOES.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/15_HISTORICO_DE_ALTERACOES.md) | Registro de versões e melhorias implementadas. |
| [`16_GLOSSARIO.md`](file:///c:/Users/edini/Desktop/APP_XIQUIM_VARGAS_VERSAO_FINAL_CORRIGIDA_25-10-2026/docs/16_GLOSSARIO.md) | Termos de negócios, siglas e conceitos da plataforma. |

