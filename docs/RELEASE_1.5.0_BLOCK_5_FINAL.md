# Xiquim Vargas ERP — Release 1.5.0 — Bloco 5 e Hardening Final

## Escopo
Hardening operacional, observabilidade, idempotência, reconciliação de estoque, backup consistente, recuperação de PDFs, ciclo de vida de rota, auditoria encadeada, UX responsiva e preparação nativa.

## Referências externas incorporadas
- OWASP ASVS: autenticação, controle de acesso, validação, logging, segurança de API e concorrência segura.
- OWASP Logging/Authorization: eventos de segurança e falhas de autorização devem ser observáveis sem expor segredos.
- SQLite WAL/Backup API: WAL deve ser tratado como parte do estado persistente e backups devem ser consistentes; VACUUM INTO é uma alternativa suportada.

## Decisões
1. SQLite permanece.
2. Não há falsa promessa de row-level locking: SQLite serializa escritores; a aplicação reduz o tempo das transações e usa WAL.
3. Pedido usa Idempotency-Key para evitar duplicação por duplo clique/retry.
4. PDF possui estado READY/PENDING/ERROR e pode ser reconstruído pelo administrador.
5. Saída de estoque é registrada ao concluir a entrega.
6. Torre recebe endpoints de métricas e reconciliação.
7. Backup é feito por script seguro com `VACUUM INTO` e `integrity_check`.
8. UI recebe uma camada final de acessibilidade, responsividade e redução de movimento.

## 50 ciclos
`scripts/qa_50_cycles_final.mjs` executa 50 ciclos reais de health/readiness, RBAC, catálogo, clientes, reconciliação, auditoria, métricas, integridade SQLite, foreign keys, estoque e encoding.

## Limites conhecidos
Os APKs Android continuam como projetos Kotlin nativos e dependem de Android SDK/Gradle para compilação local. A IA administrativa permanece somente leitura até que uma credencial de provedor seja configurada; o endpoint atual não finge executar ações externas.

## Login fix — v1.6.1

Corrigido um erro no login das interfaces de Vendedor, PDV, Motorista e Loja Online.

### Causa
`role.js` passava o objeto `SubmitEvent` diretamente para `new FormData(e)`. O construtor `FormData` exige um `HTMLFormElement`, provocando:

`Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.`

### Correção
O login agora registra o `submit` diretamente no formulário e usa `e.currentTarget` como formulário, com validação do tipo, estado de carregamento do botão e restauração do botão em caso de erro.

### Validação
- `node --check public/role.js` — PASS
- `node --check public/app.js` — PASS
- POST `/api/auth/login` com vendedor — PASS
- POST `/api/auth/login` com caixa — PASS
