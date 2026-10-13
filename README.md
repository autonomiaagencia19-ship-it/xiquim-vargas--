# Xiquim Vargas ERP 1.8.2

ERP Node.js + SQLite com interfaces web e aplicativos nativos para vendedor e motorista. Esta entrega inicia com banco vazio e sem dados de demonstração.

## Comece por aqui

1. Leia o runbook do Render e configure o disco persistente antes do primeiro deploy.
2. Consulte o handoff de engenharia para arquitetura e API.
3. Use o manual de operação para orientar os usuários.

## Execução local

Requer Node.js >=22.5.

```powershell
npm ci
$env:JWT_SECRET = 'use-um-segredo-forte-local'
$env:STORAGE_DIR = '.\storage'
npm start
```

Acesse `http://localhost:3000`. Em uma instalação nova, o servidor cria um banco SQLite vazio com o esquema atual e mostra nos logs o link temporário para criar o primeiro administrador. Cadastre os dados comerciais depois de entrar.

## Interfaces

- Torre de Controle: `/admin.html`
- Loja online: `/loja.html`
- Vendedor web: `/vendedor.html`
- Caixa/PDV: `/pdv.html`
- Motorista web: `/motorista.html`

## Render e persistência

O `render.yaml` configura o caminho `/var/data` como disco persistente e `STORAGE_DIR` aponta para ele. Banco, PDFs, comprovantes e imagens devem permanecer nesse diretório. O SQLite deste deploy usa uma única instância. Configure `PUBLIC_BASE_URL` com HTTPS para gerar o link correto do primeiro acesso.

## Desenvolvimento

Execute `npm run test:api` para a suíte da API, `npm run stress:5000` para a varredura local de 5.000 leituras autenticadas e `npm run qa:release` para a verificação de release em banco temporário. Não inclua `.env`, bancos locais, dados de `storage`, SDK Android, `node_modules`, cobertura ou APKs gerados no Git.
