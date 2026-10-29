# AUTONOMIA SYSTEMS — DEPLOY E OPERAÇÃO TÉCNICA
**Render PaaS, Arquitetura de Persistência, Topologia de Disco e Rotinas de Backup**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Produção:** https://xiquim-vargas-erp.onrender.com  
**Data:** Outubro de 2026

---

## 1. BLUEPRINT DE INFRAESTRUTURA NO RENDER (PAAS)
A aplicação em produção está hospedada na plataforma Render sob a especificação declarativa do arquivo `render.yaml`:

```yaml
services:
  - type: web
    name: xiquim-vargas-erp
    runtime: node
    plan: starter
    buildCommand: npm ci
    startCommand: npm start
    healthCheckPath: /ready
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: STORAGE_DIR
        value: /var/data
      - key: PUBLIC_BASE_URL
        sync: false
    disk:
      name: erp-data
      mountPath: /var/data
      sizeGB: 10
```

---

## 2. TOPOLOGIA DO DISCO PERSISTENTE (/var/data)
O disco persistente de 10GB montado em `/var/data` garante a longevidade dos dados independentemente de novos deploys de software ou reinicializações do container:

* `/var/data/xiquim-vargas.db`: Banco de dados relacional principal em SQLite WAL.
* `/var/data/xiquim-vargas.db-wal` e `.db-shm`: Arquivos temporários de log e memória compartilhada do modo Write-Ahead Logging.
* `/var/data/proofs/`: Fotos de comprovantes de entrega e canhotos capturados pelos motoristas.
* `/var/data/product-images/`: Fotos do catálogo oficial dos 620 produtos.
* `/var/data/store-cover/`: Banners e imagens de capa personalizadas da Loja Online.
* `/var/data/pdfs/`: Documentos PDF gerados sob demanda (pedidos e romaneios).
* `/var/data/backups/`: Snapshots diários completos do banco e mídias.

### 2.1 Garantia de Não Sobrescrita em Novos Deploys
No arquivo `src/db.js`, a rotina de inicialização protege a base existente:
```javascript
if (path.resolve(bundledDb) !== path.resolve(targetDb) && fs.existsSync(bundledDb) && !fs.existsSync(targetDb)) {
    console.log('[bootstrap] Inicializando banco persistente a partir do repositório...');
    fs.copyFileSync(bundledDb, targetDb);
}
```
**Regra Fundamental:** Se o arquivo `/var/data/xiquim-vargas.db` já existir no disco persistente do Render, o repositório **jamais** sobrescreve o banco. Toda a movimentação real, clientes, operadores e pedidos em produção permanecem 100% íntegros.

---

## 3. SUBSISTEMA DE BACKUP AUTOMATIZADO
O backup é realizado pelo script `scripts/backup.mjs` (acionado por `npm run backup`):
1. **Checkpoint de WAL:** Executa `PRAGMA wal_checkpoint(TRUNCATE)` para consolidar todas as transações pendentes no arquivo `.db` principal.
2. **Snapshot Atômico (`VACUUM INTO`):** Cria uma cópia íntegra e desfragmentada do banco sem travar as operações ativas de leitura e escrita.
3. **Checagem de Integridade Imediata:** Abre a réplica gerada e executa `PRAGMA integrity_check`. Se houver qualquer indício de corrupção, o processo aborta e emite alerta.
4. **Espelhamento das Mídias:** Copia as pastas `product-images`, `proofs`, `store-cover` e `pdfs`.
5. **Manifesto Criptográfico:** Gera o arquivo `manifest.sha256` contendo o hash de cada arquivo empacotado.
6. **Política de Retenção (Rolling 7 Dias):** Mantém os últimos 7 snapshots diários no disco, removendo snapshots mais antigos para preservar o espaço em disco.

---

## 4. PROCEDIMENTO DE RECUPERAÇÃO DE DESASTRES (RESTORE)
Em caso de necessidade de restauração:
1. Conectar via terminal SSH ou CLI do Render ao serviço.
2. Parar a aplicação temporariamente.
3. Copiar o banco de dados do snapshot desejado em `/var/data/backups/AAAA-MM-DD/xiquim-vargas.db` para `/var/data/xiquim-vargas.db`.
4. Validar o hash SHA256 contra o `manifest.sha256`.
5. Reiniciar o serviço. O health check em `/ready` confirmará a restauração bem-sucedida.
