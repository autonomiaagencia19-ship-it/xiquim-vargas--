# Benchmark de ERP — 2026

## Base externa

A evolução do Xiquim Vargas nesta release considerou padrões observados em ERPs relevantes de 2026, sem copiar arquitetura proprietária.

- ERP Research destaca SAP S/4HANA, Oracle NetSuite, Microsoft Dynamics 365, Acumatica, Odoo e outros e considera profundidade funcional, TCO, risco de implantação, roadmap e IA implantada. [ERP Research, 2026]
- No mercado brasileiro, levantamentos públicos destacam Omie, Bling, Conta Azul, TOTVS, Sankhya, SAP Business One e Tiny em diferentes portes e verticais. [QualSoftware, 2026]
- Conteúdos sobre distribuição destacam estoque, fulfillment, integração multicanal, logística, relatórios e arquitetura de integração como dimensões relevantes.

## O que foi absorvido

1. **Uma fonte única de verdade operacional** para vendas, estoque, clientes e logística.
2. **Estoque em tempo real** e movimentação auditável.
3. **Controle de preço por tabela**, evitando preço vindo do navegador como fonte de verdade.
4. **Dashboards operacionais** com indicadores derivados do banco.
5. **Auditoria** das ações administrativas.
6. **RBAC real no backend**, não apenas ocultação de botões.
7. **Operação multicanal**: loja, vendedor e PDV convergem para o mesmo núcleo transacional.
8. **Mobilidade nativa** para vendedor e motorista.
9. **Logística orientada por dados** e rota pré-calculada.
10. **IA subordinada ao núcleo transacional**, evitando que uma indisponibilidade de IA derrube vendas.
11. **Paginação e índices** para evitar que o crescimento do catálogo degrade a interface.
12. **Resiliência SQLite/WAL**, apropriada à premissa atual do produto.

## O que deliberadamente não foi copiado

Não foram adicionados módulos apenas para inflar a lista de funcionalidades. Fiscal, contabilidade completa, folha, manufatura, compras avançadas e multiempresa exigem desenho próprio antes de entrarem no núcleo.

## Referências

ERP Research — Best ERP Software 2026.
QualSoftware — Melhores ERPs para Empresas Brasileiras em 2026.
Omie — Melhores sistemas ERP do mercado em 2026.
Technology Advice — Best ERP Software 2026.
