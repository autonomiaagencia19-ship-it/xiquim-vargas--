# Engineering Handoff — Xiquim Vargas ERP v1.1.0

## Estado

O núcleo foi implementado sobre Node.js + SQLite, com cinco interfaces web e dois projetos Android/Kotlin nativos. O MVP visual fornecido em HTML foi preservado como referência estrutural e a implementação foi conectada a dados reais.

## Núcleo

- Ring 0: JWT, RBAC, rate limit básico, validação, auditoria.
- Ring 1: transações SQLite com `BEGIN IMMEDIATE`, estoque reservado e conclusão transacional.
- Ring 2: endpoints por domínio e interfaces especializadas.
- Ring 3: cálculo de rota e contexto determinístico para IA.

## Banco

SQLite permanece como banco oficial. WAL, foreign keys e busy timeout são ativados. O banco deve ser preservado e migrado incrementalmente.

## Fluxo de pedido

`PENDENTE → SEPARACAO → ROTA → CONCLUIDO`

A transição para rota acontece pela criação de uma rota. A conclusão acontece pelo motorista ou administrador através do endpoint logístico.

## Segurança

Arquivos em `storage/` não são públicos. PDFs e comprovantes passam por autenticação e escopo. O JWT de desenvolvimento não pode ser usado com `NODE_ENV=production`.

## Android

`mobile/seller-native` e `mobile/driver-native` são Android/Kotlin, sem Expo Go e sem React Native. O endereço padrão para emulador é `10.0.2.2:3000`; para produção deve ser configurado o endpoint HTTPS real.

## Limitações conhecidas

- Não houve compilação APK neste ambiente por ausência do Android SDK/Gradle.
- Geocodificação e TSP usam coordenadas existentes no cadastro; não existe geocodificação automática externa no núcleo.
- IA administrativa atual é determinística/fallback; o provedor LLM deve ser conectado por configuração segura antes de produção.
- TLS deve ser terminado por reverse proxy/infraestrutura de produção.
