# Segurança

1. JWT HS256 assinado no backend.
2. Senhas com scrypt + salt aleatório.
3. RBAC no backend.
4. Auditoria de operações críticas.
5. Impersonation auditável e reversível.
6. API keys de IA não ficam no frontend.
7. SQLite com foreign keys, WAL e busy timeout.
8. Transações curtas para estoque/pedido.
9. Erros internos não são enviados com stack trace.
10. Credenciais seed são exclusivamente de desenvolvimento.
