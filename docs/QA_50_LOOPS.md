# QA — 50 Loops Reais

## Resultado

Foram executados 50 loops consecutivos sobre a versão final após hardening.

Cada loop verificou: login das cinco roles, isolamento RBAC, proteção do armazenamento, criação de pedido com preço determinado pelo backend, tentativa de bypass de status, separação, geração de rota, bloqueio de rota duplicada, conclusão pelo motorista, idempotência da conclusão, acesso ao PDF, integridade SQLite, foreign keys e não negativação de estoque.

**Resultado: 50/50 PASS.**

## Correções encontradas durante o ciclo de hardening

1. O endpoint de arquivos podia lançar exceção fora do tratamento global quando acessado sem autenticação. Corrigido.
2. O armazenamento passou a exigir autenticação e autorização por pedido/comprovante.
3. Proteção contra path traversal foi endurecida com `path.resolve`.
4. O fluxo de status deixou de permitir que a Torre pulasse `SEPARACAO → ROTA` sem criar rota.
5. Caixa ficou limitada à transição `PENDENTE → SEPARACAO` de pedidos próprios de balcão.
6. Rotas agora exigem pedidos em `SEPARACAO`, motorista válido e impedem pedido duplicado em rota.
7. Criação de rota tornou-se transacional.
8. Conclusão de entrega passou a ser transacional e idempotente.
9. Tentativa de concluir pedido fora de `ROTA` é rejeitada.
10. Limite de payload e rate limit básico de login foram adicionados.
11. Em produção, o segredo JWT de desenvolvimento é rejeitado.
12. Interfaces de vendedor, motorista, PDV e loja passaram a validar a role esperada.
13. O motorista web deixou de usar endereço hardcoded e usa o endereço do pedido.
14. Apps móveis nativos receberam fluxo real de login, carteira/pedido e fila/entrega.

## Observação

Os APKs Android não foram declarados como compilados nesta sessão porque o Android SDK/Gradle não está disponível no ambiente de execução. Os projetos fonte são nativos Kotlin e devem ser compilados no Android Studio/CI Android.
