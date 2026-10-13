# Runbook Operacional e Manutenção DevOps - Xiquim Vargas v1.8.1

Este documento é a bíblia de operações, resiliência e manutenção de infraestrutura do sistema ERP hospedado no PaaS Render. Desenvolvido para que Administradores de Banco de Dados (DBAs) e Engenheiros Cloud possam assumir a gestão sem curva de aprendizado.

---

## 1. Topologia da Nuvem (Render Cloud)

O sistema foi otimizado para operar em uma instância "Web Service" do Render rodando ambiente Nativo Node.js. O ERP repudia bancos externos pesados para economizar latência e custos de I/O.

### 1.1 Variáveis de Ambiente Críticas (Environment Variables)
No painel do Render > Settings > Environment, as seguintes variáveis mantêm o ecossistema respirando:
*   `JWT_SECRET`: A string criptográfica (salt) usada para assinar a permanência dos Vendedores e Motoristas. **Atenção:** Mudar isso invalida a sessão offline de todos os aplicativos de rua simultaneamente, forçando-os a relogar.
*   `PORT`: Monitorada pelo health check do Render. Se nula, usa porta 3000.
*   `STORAGE_PATH`: Caminho absoluto onde o disco persistente está montado na instância. Ex: `/data/storage`. Se isso não for definido, o SQLite será escrito na RAM/Disco efêmero e o banco será dizimado no primeiro deploy.

### 1.2 Discos Persistentes (Render Persistent Disks)
O disco anexado em `/data/storage` atua como o verdadeiro disco rígido da aplicação. A árvore de diretórios criada pelo sistema dentro dele:
*   `/xiquim.db` (Banco Principal de Produção)
*   `/xiquim.db-wal` e `/xiquim.db-shm` (Arquivos temporários do Write-Ahead Logging do SQLite).
*   `/product-images/` (Fotos comprimidas atreladas ao catálogo).
*   `/proofs/` (Fotos em Base64 dos canhotos de entrega convertidas e salvas como PNG/JPG).
*   `/backups/` (Arquivos ZIP criados pelo script interno).

---

## 2. A Rotina de Backups Autônomos (Cron e Extração)

Nunca confie cegamente na nuvem. A arquitetura v1.8.1 possui um script de snapshot inteligente (`scripts/backup.mjs`).

**O que o Script Interno Faz:**
Ele aciona o comando cirúrgico `VACUUM INTO 'arquivo'` do SQLite. O SQLite "pausa" sub-milissegundos as transações, clona o banco perfeitamente alinhado com a memória WAL para um arquivo em `/backups/data_atual/`, joga as fotos na pasta, cria uma hash SHA-256 de auditoria, e compacta.

**Como extrair para o Notebook da Empresa:**
É imperativo que você agende uma requisição automatizada no Windows (via PowerShell ou Curl) no notebook do gestor corporativo para raspar esse arquivo do Render:
1. Abra o Task Scheduler do Windows.
2. Agende o seguinte script via PowerShell:
   `Invoke-WebRequest -Uri "https://seu-sistema.onrender.com/api/sistema/gerar_backup_secreto" -Headers @{Authorization="Bearer SEU_TOKEN_ADMIN"} -OutFile "C:\Backups\ERP_Data.zip"`
*(Nota: A equipe preparou ou pode criar essa API endpoint para devolver o ZIP mastigado de forma segura).*

---

## 3. Guia de Troubleshooting (Resolução de Problemas Complexos)

### Anomalia A: Motorista envia o Canhoto, mas acusa "Erro de Rede" no aplicativo.
**Causa Mais Provável:** O servidor atingiu o limite de memória ou de banda fazendo o encode da imagem (Payload too large). O Node.js express costuma bloquear payloads enormes. O app mobile está retendo a submissão na fila `Outbox`.
**Ação:** Verifique os logs do Render. Cheque se o limite do `express.json({ limit: '10mb' })` no `server.js` foi configurado e se é suficiente para a câmera moderna do motorista.

### Anomalia B: Preços das Tabelas de Atacado não estão batendo na rua.
**Causa Mais Provável:** O vendedor entrou no modo "Mato" (sem internet) antes de o Administrador ter vinculado o Cliente X à "Tabela Supermercado Y".
**Ação:** Instrua o vendedor a ir para uma zona com Wi-Fi/4G e apertar o botão "Atualizar Sincronização". O sistema baixará o hash atualizado das tabelas do servidor e re-precificará o carrinho imediatamente.

### Anomalia C: Banco SQLite trava lançando erro "SQLITE_BUSY".
**Causa Mais Provável:** Muitas threads do Node.js bloqueando I/O enquanto tentam gravar na mesma linha ao mesmo tempo sem que o modo WAL estivesse preparado para picos absurdos.
**Ação:** A versão 1.8.1 já tem mitigação para isso. Caso retorne, force a reinicialização da instância Web Service no Render. Isso reinjetará a flag `PRAGMA busy_timeout = 5000` no gatilho de inicialização do backend.

---

## 4. Scripts e Automações NPM Inclusos

O pacote inclui scripts maduros para manutenção rápida:
- `node scripts/seed_data.cjs`: Preenche o sistema com 100 produtos fictícios e clientes de teste (Rode apenas em laboratório ou instâncias separadas para treinamento).
- `node scripts/update_passwords.cjs`: Força o recálculo dos algoritmos de Hash de senha caso haja suspeita de violação no banco de dados.
- `powershell scripts/qa_release.ps1`: Assina as versões locais para produção.
