# Test Plan

## Smoke
- health
- login
- RBAC
- catálogo
- estoque
- pedido
- PDF
- rota
- conclusão

## Red Team
- acesso sem token a arquivos
- path traversal
- role escalation
- seller → admin
- cashier → pedido de seller
- status bypass
- rota duplicada
- motorista inválido
- conclusão repetida
- estoque negativo
- foreign key integrity
- JSON inválido
- payload excessivo
- brute force básico de login

## Resultado atual
50/50 loops finais aprovados após as correções de hardening.
