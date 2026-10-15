import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(process.cwd());
export const STORAGE = path.resolve(process.env.STORAGE_DIR || path.join(ROOT,'storage'));
function ensureStorage(){
  fs.mkdirSync(STORAGE,{recursive:true});
  fs.mkdirSync(path.join(STORAGE,'pdfs'),{recursive:true});
  fs.mkdirSync(path.join(STORAGE,'proofs'),{recursive:true});
  fs.mkdirSync(path.join(STORAGE,'product-images'),{recursive:true});

  if (process.env.NODE_ENV !== 'test') {
    const bundledDb = path.join(ROOT, 'storage', 'xiquim-vargas.db');
    const targetDb = path.join(STORAGE, 'xiquim-vargas.db');
    if (path.resolve(bundledDb) !== path.resolve(targetDb) && fs.existsSync(bundledDb) && !fs.existsSync(targetDb)) {
      try {
        console.log(`[bootstrap] Inicializando banco persistente a partir do repositório (${bundledDb})...`);
        fs.copyFileSync(bundledDb, targetDb);
        console.log(`[bootstrap] Banco de dados copiado para ${targetDb}`);
      } catch (err) {
        console.error('[bootstrap] Erro ao copiar banco de dados:', err.message);
      }
    }

    const bundledImages = path.join(ROOT, 'storage', 'product-images');
    const targetImages = path.join(STORAGE, 'product-images');
    if (path.resolve(bundledImages) !== path.resolve(targetImages) && fs.existsSync(bundledImages)) {
      try {
        const existing = fs.existsSync(targetImages) ? fs.readdirSync(targetImages) : [];
        if (existing.length === 0) {
          console.log(`[bootstrap] Copiando imagens de produtos para ${targetImages}...`);
          fs.cpSync(bundledImages, targetImages, { recursive: true });
          console.log(`[bootstrap] Imagens de produtos copiadas.`);
        }
      } catch (err) {
        console.error('[bootstrap] Erro ao copiar imagens de produtos:', err.message);
      }
    }
  }
}
ensureStorage();
export const db = new DatabaseSync(path.join(STORAGE,'xiquim-vargas.db'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`);

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios(id TEXT PRIMARY KEY,nome TEXT NOT NULL,email TEXT UNIQUE NOT NULL,senha_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','seller','cashier','driver','web_client')),ativo INTEGER NOT NULL DEFAULT 1,telefone TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categorias(id TEXT PRIMARY KEY,nome TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,descricao TEXT,ordem INTEGER DEFAULT 0,ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subcategorias(id TEXT PRIMARY KEY,categoria_id TEXT NOT NULL REFERENCES categorias(id),nome TEXT NOT NULL,slug TEXT NOT NULL,ordem INTEGER DEFAULT 0,ativo INTEGER NOT NULL DEFAULT 1,UNIQUE(categoria_id,slug));
CREATE TABLE IF NOT EXISTS produtos(id TEXT PRIMARY KEY,nome TEXT NOT NULL,sku TEXT UNIQUE NOT NULL,codigo_barras TEXT UNIQUE,marca TEXT,sabor TEXT,tamanho TEXT,unidade TEXT,descricao TEXT,foto_url TEXT,categoria_id TEXT REFERENCES categorias(id),subcategoria_id TEXT REFERENCES subcategorias(id),preco_base REAL NOT NULL DEFAULT 0,ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS estoque(produto_id TEXT PRIMARY KEY REFERENCES produtos(id),quantidade_disponivel INTEGER NOT NULL DEFAULT 0,quantidade_reservada INTEGER NOT NULL DEFAULT 0,estoque_minimo INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS movimentacoes_estoque(id TEXT PRIMARY KEY,produto_id TEXT NOT NULL REFERENCES produtos(id),tipo TEXT NOT NULL,quantidade INTEGER NOT NULL,quantidade_anterior INTEGER NOT NULL,quantidade_posterior INTEGER NOT NULL,operador_id TEXT REFERENCES usuarios(id),observacao TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tabelas_preco(id TEXT PRIMARY KEY,nome TEXT NOT NULL,ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tabela_preco_itens(id TEXT PRIMARY KEY,tabela_id TEXT NOT NULL REFERENCES tabelas_preco(id),produto_id TEXT NOT NULL REFERENCES produtos(id),preco REAL NOT NULL,quantidade_minima INTEGER DEFAULT 1,UNIQUE(tabela_id,produto_id));
CREATE TABLE IF NOT EXISTS clientes(id TEXT PRIMARY KEY,razao_social TEXT NOT NULL,nome_fantasia TEXT,cnpj_cpf TEXT UNIQUE NOT NULL,email TEXT,telefone TEXT,endereco TEXT NOT NULL,cidade TEXT,estado TEXT,cep TEXT,latitude REAL,longitude REAL,tabela_preco_id TEXT REFERENCES tabelas_preco(id),vendedor_id TEXT REFERENCES usuarios(id),ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedidos(id TEXT PRIMARY KEY,numero TEXT UNIQUE NOT NULL,cliente_id TEXT NOT NULL REFERENCES clientes(id),operador_id TEXT REFERENCES usuarios(id),origem TEXT NOT NULL CHECK(origem IN ('WEB','VENDEDOR','BALCAO')),status TEXT NOT NULL CHECK(status IN ('PENDENTE','SEPARACAO','ROTA','CONCLUIDO')),total REAL NOT NULL DEFAULT 0,pdf_path TEXT,observacoes TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedido_itens(id TEXT PRIMARY KEY,pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,produto_id TEXT NOT NULL REFERENCES produtos(id),quantidade INTEGER NOT NULL,preco_unitario_aplicado REAL NOT NULL,subtotal REAL NOT NULL);
CREATE TABLE IF NOT EXISTS rotas_logistica(id TEXT PRIMARY KEY,motorista_id TEXT REFERENCES usuarios(id),data TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PLANEJADA',sequencia_json TEXT NOT NULL DEFAULT '[]',distance_km REAL,estimated_minutes INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rota_pedidos(rota_id TEXT NOT NULL REFERENCES rotas_logistica(id) ON DELETE CASCADE,pedido_id TEXT NOT NULL REFERENCES pedidos(id),ordem INTEGER NOT NULL,PRIMARY KEY(rota_id,pedido_id));
CREATE TABLE IF NOT EXISTS comprovantes_entrega(id TEXT PRIMARY KEY,pedido_id TEXT NOT NULL REFERENCES pedidos(id),motorista_id TEXT NOT NULL REFERENCES usuarios(id),arquivo_path TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs(id TEXT PRIMARY KEY,user_id TEXT REFERENCES usuarios(id),action TEXT NOT NULL,entity TEXT NOT NULL,entity_id TEXT,before_json TEXT,after_json TEXT,ip TEXT,user_agent TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS configuracoes(chave TEXT PRIMARY KEY,valor TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS produto_imagens(id TEXT PRIMARY KEY,produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,arquivo_path TEXT NOT NULL,mime_type TEXT NOT NULL,tamanho_bytes INTEGER NOT NULL,principal INTEGER NOT NULL DEFAULT 0,ordem INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(produto_id,arquivo_path));
CREATE TABLE IF NOT EXISTS promocoes(id TEXT PRIMARY KEY,produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,nome TEXT NOT NULL,preco_promocional REAL NOT NULL,inicio TEXT,termino TEXT,ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS produto_imagens(id TEXT PRIMARY KEY,produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,arquivo_path TEXT NOT NULL,mime_type TEXT NOT NULL,tamanho_bytes INTEGER NOT NULL,principal INTEGER NOT NULL DEFAULT 0,ordem INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(produto_id,arquivo_path));
CREATE TABLE IF NOT EXISTS promocoes(id TEXT PRIMARY KEY,produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,nome TEXT NOT NULL,preco_promocional REAL NOT NULL,inicio TEXT,termino TEXT,ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE TABLE IF NOT EXISTS usuario_clientes(usuario_id TEXT PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,cliente_id TEXT UNIQUE NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS pedido_retornos(id TEXT PRIMARY KEY,pedido_id TEXT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,rota_id TEXT REFERENCES rotas_logistica(id) ON DELETE SET NULL,motorista_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,motivo TEXT NOT NULL,descricao TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome); CREATE INDEX IF NOT EXISTS idx_produtos_barcode ON produtos(codigo_barras); CREATE INDEX IF NOT EXISTS idx_clientes_doc ON clientes(cnpj_cpf); CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status); CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id); CREATE INDEX IF NOT EXISTS idx_pedidos_operador ON pedidos(operador_id); CREATE INDEX IF NOT EXISTS idx_itens_produto ON pedido_itens(produto_id); CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity,entity_id); CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at); CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id,subcategoria_id); CREATE INDEX IF NOT EXISTS idx_produto_imagens_produto ON produto_imagens(produto_id,principal,ordem); CREATE INDEX IF NOT EXISTS idx_promocoes_produto ON promocoes(produto_id,ativo,inicio,termino); CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto ON movimentacoes_estoque(produto_id,created_at); CREATE INDEX IF NOT EXISTS idx_rota_pedido ON rota_pedidos(pedido_id); CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(vendedor_id); CREATE INDEX IF NOT EXISTS idx_pedido_retornos_pedido ON pedido_retornos(pedido_id); CREATE INDEX IF NOT EXISTS idx_pedido_retornos_created ON pedido_retornos(created_at);
`);

// Incremental, restart-safe migrations for the commercial hardening layer.
function hasColumn(table, column){ return all(`PRAGMA table_info(${table})`).some(x=>x.name===column) }
if(!hasColumn('clientes','bairro')) db.exec("ALTER TABLE clientes ADD COLUMN bairro TEXT");
if(!hasColumn('pedidos','modalidade_entrega')) db.exec("ALTER TABLE pedidos ADD COLUMN modalidade_entrega TEXT NOT NULL DEFAULT 'RETIRADA' CHECK(modalidade_entrega IN ('ENTREGA','RETIRADA'))");
db.exec("INSERT OR IGNORE INTO clientes(id,razao_social,nome_fantasia,cnpj_cpf,endereco,ativo) VALUES('CLIENTE-BALCAO','Cliente Balcão','Cliente Balcão','TEMP-CLIENTE-BALCAO','Atendimento no balcão',1)");
db.exec("UPDATE clientes SET endereco='' WHERE id='CLIENTE-BALCAO' AND endereco='Atendimento no balcão'");
db.exec("UPDATE pedidos SET modalidade_entrega=CASE WHEN origem='BALCAO' THEN 'RETIRADA' ELSE 'ENTREGA' END WHERE modalidade_entrega='RETIRADA'");

function migrateProdutosSkuNullable(){
  const info=all('PRAGMA table_info(produtos)');
  const sku=info.find(x=>x.name==='sku');
  if(!sku || Number(sku.notnull)!==1) return;
  const hasEs=info.some(x=>x.name==='esgotado');
  db.exec('PRAGMA foreign_keys=OFF');
  try{
    db.exec(`
      CREATE TABLE produtos_new(
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        sku TEXT UNIQUE,
        codigo_barras TEXT UNIQUE,
        marca TEXT,
        sabor TEXT,
        tamanho TEXT,
        unidade TEXT,
        descricao TEXT,
        foto_url TEXT,
        categoria_id TEXT REFERENCES categorias(id),
        subcategoria_id TEXT REFERENCES subcategorias(id),
        preco_base REAL NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP${hasEs?',\n        esgotado INTEGER NOT NULL DEFAULT 0':''}
      );
      INSERT INTO produtos_new(id,nome,sku,codigo_barras,marca,sabor,tamanho,unidade,descricao,foto_url,categoria_id,subcategoria_id,preco_base,ativo,created_at,updated_at${hasEs?',esgotado':''})
      SELECT id,nome,NULLIF(TRIM(sku),''),codigo_barras,marca,sabor,tamanho,unidade,descricao,foto_url,categoria_id,subcategoria_id,preco_base,ativo,created_at,updated_at${hasEs?',esgotado':''}
      FROM produtos;
      DROP TABLE produtos;
      ALTER TABLE produtos_new RENAME TO produtos;
    `);
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }
}
migrateProdutosSkuNullable();

if(!hasColumn('pedidos','subtotal_bruto')) db.exec("ALTER TABLE pedidos ADD COLUMN subtotal_bruto REAL NOT NULL DEFAULT 0");
if(!hasColumn('pedidos','desconto_tipo')) db.exec("ALTER TABLE pedidos ADD COLUMN desconto_tipo TEXT NOT NULL DEFAULT 'VALOR'");
if(!hasColumn('pedidos','desconto_valor')) db.exec("ALTER TABLE pedidos ADD COLUMN desconto_valor REAL NOT NULL DEFAULT 0");
if(!hasColumn('pedidos','forma_pagamento')) db.exec("ALTER TABLE pedidos ADD COLUMN forma_pagamento TEXT");
if(!hasColumn('pedidos','pagamento_status')) db.exec("ALTER TABLE pedidos ADD COLUMN pagamento_status TEXT NOT NULL DEFAULT 'NAO_RECEBIDO'");
if(!hasColumn('pedidos','valor_recebido')) db.exec("ALTER TABLE pedidos ADD COLUMN valor_recebido REAL");
if(!hasColumn('pedidos','troco')) db.exec("ALTER TABLE pedidos ADD COLUMN troco REAL");
if(!hasColumn('pedidos','cartao_modalidade')) db.exec("ALTER TABLE pedidos ADD COLUMN cartao_modalidade TEXT");
if(!hasColumn('pedidos','parcelas')) db.exec("ALTER TABLE pedidos ADD COLUMN parcelas INTEGER");
if(!hasColumn('pedidos','pdf_status')) db.exec("ALTER TABLE pedidos ADD COLUMN pdf_status TEXT NOT NULL DEFAULT 'PENDING'");
if(!hasColumn('pedidos','pdf_error')) db.exec("ALTER TABLE pedidos ADD COLUMN pdf_error TEXT");
if(!hasColumn('pedidos','cancelled_at')) db.exec("ALTER TABLE pedidos ADD COLUMN cancelled_at TEXT");
if(!hasColumn('pedidos','cancelled_by')) db.exec("ALTER TABLE pedidos ADD COLUMN cancelled_by TEXT REFERENCES usuarios(id)");
if(!hasColumn('pedidos','cancel_reason')) db.exec("ALTER TABLE pedidos ADD COLUMN cancel_reason TEXT");
if(!hasColumn('pedidos','cancelled_snapshot_json')) db.exec("ALTER TABLE pedidos ADD COLUMN cancelled_snapshot_json TEXT");
if(!hasColumn('audit_logs','integrity_hash')) db.exec("ALTER TABLE audit_logs ADD COLUMN integrity_hash TEXT");
if(!hasColumn('tabela_preco_itens','quantidade_minima')) db.exec("ALTER TABLE tabela_preco_itens ADD COLUMN quantidade_minima INTEGER NOT NULL DEFAULT 1");
for(const [table,column] of [['pedidos','pdf_path'],['comprovantes_entrega','arquivo_path'],['produto_imagens','arquivo_path']]){for(const row of all(`SELECT id,${column} value FROM ${table} WHERE ${column} IS NOT NULL`)){if(path.isAbsolute(String(row.value))){const relative=path.relative(STORAGE,String(row.value));if(relative&&relative!=='..'&&!relative.startsWith('..'+path.sep))run(`UPDATE ${table} SET ${column}=? WHERE id=?`,[relative.split(path.sep).join('/'),row.id])}}}
if(!hasColumn('produtos','esgotado')) db.exec("ALTER TABLE produtos ADD COLUMN esgotado INTEGER NOT NULL DEFAULT 0");
db.exec(`
CREATE TABLE IF NOT EXISTS rotas_config(id TEXT PRIMARY KEY,nome TEXT NOT NULL,dia_semana INTEGER NOT NULL CHECK(dia_semana BETWEEN 1 AND 6),ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS rota_bairros(id TEXT PRIMARY KEY,rota_config_id TEXT NOT NULL REFERENCES rotas_config(id) ON DELETE CASCADE,bairro TEXT NOT NULL,ordem INTEGER NOT NULL DEFAULT 1,UNIQUE(rota_config_id,bairro));
CREATE TABLE IF NOT EXISTS vendedor_rotas(vendedor_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,rota_config_id TEXT NOT NULL REFERENCES rotas_config(id) ON DELETE CASCADE,dia_semana INTEGER NOT NULL CHECK(dia_semana BETWEEN 1 AND 6),PRIMARY KEY(vendedor_id,dia_semana));
CREATE INDEX IF NOT EXISTS idx_rotas_config_dia ON rotas_config(dia_semana,ativo);
CREATE INDEX IF NOT EXISTS idx_rota_bairros_bairro ON rota_bairros(bairro);
CREATE INDEX IF NOT EXISTS idx_vendedor_rotas_dia ON vendedor_rotas(vendedor_id,dia_semana);
CREATE INDEX IF NOT EXISTS idx_clientes_bairro ON clientes(bairro);
CREATE INDEX IF NOT EXISTS idx_pedidos_pagamento ON pedidos(pagamento_status,forma_pagamento);

CREATE TABLE IF NOT EXISTS idempotency_keys(
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES usuarios(id), route TEXT NOT NULL,
  key_value TEXT NOT NULL, response_status INTEGER NOT NULL, response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,route,key_value)
);
CREATE TABLE IF NOT EXISTS system_events(
  id TEXT PRIMARY KEY, level TEXT NOT NULL, event TEXT NOT NULL, request_id TEXT,
  message TEXT, metadata_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at);
CREATE INDEX IF NOT EXISTS idx_system_events_level ON system_events(level,created_at);

CREATE TABLE IF NOT EXISTS fornecedores(
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj_cpf TEXT,
  contato_nome TEXT,
  telefone_whatsapp TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  lead_time_padrao_dias INTEGER NOT NULL DEFAULT 5,
  condicoes_pagamento TEXT,
  observacoes TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fornecedor_produtos(
  id TEXT PRIMARY KEY,
  fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  codigo_referencia_fornecedor TEXT,
  custo_aquisicao REAL NOT NULL DEFAULT 0,
  lead_time_dias INTEGER,
  quantidade_minima_compra INTEGER DEFAULT 1,
  preferencial INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(fornecedor_id, produto_id)
);

CREATE TABLE IF NOT EXISTS compras(
  id TEXT PRIMARY KEY,
  numero TEXT UNIQUE NOT NULL,
  fornecedor_id TEXT NOT NULL REFERENCES fornecedores(id),
  comprador_id TEXT REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'CONFIRMADO' CHECK(status IN ('PENDENTE','CONFIRMADO','A_CAMINHO','RECEBIDO_PARCIAL','CONCLUIDO','CANCELADO')),
  data_emissao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  previsao_entrega TEXT NOT NULL,
  data_conclusao TEXT,
  valor_total REAL NOT NULL DEFAULT 0,
  numero_nota_fiscal TEXT,
  chave_acesso_nfe TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compra_itens(
  id TEXT PRIMARY KEY,
  compra_id TEXT NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  quantidade_pedida INTEGER NOT NULL,
  quantidade_recebida INTEGER NOT NULL DEFAULT 0,
  custo_unitario REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_nome ON fornecedores(nome);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj_cpf);
CREATE INDEX IF NOT EXISTS idx_forn_prod_forn ON fornecedor_produtos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_forn_prod_prod ON fornecedor_produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_compras_status ON compras(status);
CREATE INDEX IF NOT EXISTS idx_compras_fornecedor ON compras(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_previsao ON compras(previsao_entrega);
CREATE INDEX IF NOT EXISTS idx_compra_itens_compra ON compra_itens(compra_id);

CREATE TABLE IF NOT EXISTS cliente_interacoes(
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  usuario_id TEXT REFERENCES usuarios(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('WHATSAPP','LIGACAO','VISITA','COBRANCA','OBSERVACAO')),
  descricao TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cliente_interacoes_cliente ON cliente_interacoes(cliente_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cliente_interacoes_tipo ON cliente_interacoes(tipo);
`);


export const id=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
function cleanParams(params){return (Array.isArray(params)?params:[params]).map(x=>x===undefined?null:x)}
export function one(sql,params=[]){return db.prepare(sql).get(...cleanParams(params))??null}
export function all(sql,params=[]){return db.prepare(sql).all(...cleanParams(params))}
export function run(sql,params=[]){return db.prepare(sql).run(...cleanParams(params))}
export function tx(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){try{db.exec('ROLLBACK')}catch{};throw e}}
let onAuditCallback = null;
export function setAuditCallback(fn) { onAuditCallback = fn; }
export function audit({userId,action,entity,entityId,before=null,after=null,ip='',ua=''}){
 const prev=one('SELECT integrity_hash FROM audit_logs ORDER BY created_at DESC,rowid DESC LIMIT 1')?.integrity_hash||'';
 const payload=JSON.stringify({prev,userId:userId||null,action,entity,entityId:entityId||null,before,after,ip,ua});
 const integrity_hash=crypto.createHash('sha256').update(payload).digest('hex');
 run(`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,before_json,after_json,ip,user_agent,integrity_hash) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id(),userId||null,action,entity,entityId||null,before?JSON.stringify(before):null,after?JSON.stringify(after):null,ip,ua,integrity_hash]);
 if(onAuditCallback){ try{ onAuditCallback(action,entity,entityId,after); }catch(e){} }
}
