# AUTONOMIA SYSTEMS — DEPLOY E OPERAÇÃO TÉCNICA
**Render PaaS, Arquitetura de Persistência, Streaming SSE e Backup**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **Produção:** https://xiquim-vargas-erp.onrender.com  
**Data:** Outubro de 2026

---

## 1. BLUEPRINT DE IMPLANTAÇÃO NO RENDER (PAAS)
O serviço de produção opera na nuvem do Render sob o manifesto `render.yaml`:
* **URL Oficial:** `https://xiquim-vargas-erp.onrender.com`
* **Runtime:** Node.js 22 LTS
* **Plano:** Starter com disco persistente
* **Build Command:** `npm ci`
* **Start Command:** `npm start`
* **Readiness Probe:** `GET /ready`

---

## 2. TOPOLOGIA DO DISCO PERSISTENTE (STORAGE_DIR)
O Render vincula um Persistent Disk de 10GB montado em `/var/data` (`STORAGE_DIR=/var/data`):
* `/var/data/xiquim-vargas.db`: Banco relacional SQLite ativo em modo WAL.
* `/var/data/proofs/`: Fotos de comprovantes de entrega e assinaturas digitais.
* `/var/data/product-images/`: Catálogo de fotos dos 626 produtos.
* `/var/data/backups/`: Snapshots locais gerados pelo script de backup.

### 2.1 Garantia de Preservação de Dados no Deploy
O arquivo `src/db.js` possui lógica de proteção de inicialização:
```javascript
if (path.resolve(bundledDb) !== path.resolve(targetDb) && fs.existsSync(bundledDb) && !fs.existsSync(targetDb)) {
    fs.copyFileSync(bundledDb, targetDb);
}
```
**Regra de Ouro:** O banco de dados no disco persistente no Render nunca é sobrescrito em novos deploys de código. Usuários, clientes e pedidos criados em produção permanecem 100% seguros.

---

## 3. POLÍTICA DE BACKUP E PROTEÇÃO NO .GITIGNORE
* Backups automáticos são gerados via `npm run backup` executando checkpoint de WAL (`PRAGMA wal_checkpoint(TRUNCATE)`).
* O arquivo `.gitignore` do repositório contém regras estritas (`storage/*backup*`, `*backup*.db`) para impedir que dados sensíveis de clientes ou backups de banco sejam enviados involuntariamente ao GitHub.
