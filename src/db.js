import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(process.cwd());
export const STORAGE = path.join(ROOT,'storage');
fs.mkdirSync(STORAGE,{recursive:true}); fs.mkdirSync(path.join(STORAGE,'pdfs'),{recursive:true}); fs.mkdirSync(path.join(STORAGE,'proofs'),{recursive:true});
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
CREATE TABLE IF NOT EXISTS tabela_preco_itens(id TEXT PRIMARY KEY,tabela_id TEXT NOT NULL REFERENCES tabelas_preco(id),produto_id TEXT NOT NULL REFERENCES produtos(id),preco REAL NOT NULL,UNIQUE(tabela_id,produto_id));
CREATE TABLE IF NOT EXISTS clientes(id TEXT PRIMARY KEY,razao_social TEXT NOT NULL,nome_fantasia TEXT,cnpj_cpf TEXT UNIQUE NOT NULL,email TEXT,telefone TEXT,endereco TEXT NOT NULL,cidade TEXT,estado TEXT,cep TEXT,latitude REAL,longitude REAL,limite_credito REAL NOT NULL DEFAULT 0,tabela_preco_id TEXT REFERENCES tabelas_preco(id),vendedor_id TEXT REFERENCES usuarios(id),ativo INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
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
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome); CREATE INDEX IF NOT EXISTS idx_produtos_barcode ON produtos(codigo_barras); CREATE INDEX IF NOT EXISTS idx_clientes_doc ON clientes(cnpj_cpf); CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status); CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id); CREATE INDEX IF NOT EXISTS idx_pedidos_operador ON pedidos(operador_id); CREATE INDEX IF NOT EXISTS idx_itens_produto ON pedido_itens(produto_id); CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity,entity_id); CREATE INDEX IF NOT EXISTS idx_pedidos_created ON pedidos(created_at); CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id,subcategoria_id); CREATE INDEX IF NOT EXISTS idx_produto_imagens_produto ON produto_imagens(produto_id,principal,ordem); CREATE INDEX IF NOT EXISTS idx_promocoes_produto ON promocoes(produto_id,ativo,inicio,termino); CREATE INDEX IF NOT EXISTS idx_produto_imagens_produto ON produto_imagens(produto_id,principal,ordem); CREATE INDEX IF NOT EXISTS idx_promocoes_produto ON promocoes(produto_id,ativo,inicio,termino); CREATE INDEX IF NOT EXISTS idx_mov_estoque_produto ON movimentacoes_estoque(produto_id,created_at); CREATE INDEX IF NOT EXISTS idx_rota_pedido ON rota_pedidos(pedido_id); CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes(vendedor_id);
`);

// Incremental, restart-safe migrations for the commercial hardening layer.
function hasColumn(table, column){ return all(`PRAGMA table_info(${table})`).some(x=>x.name===column) }
if(!hasColumn('pedidos','pdf_status')) db.exec("ALTER TABLE pedidos ADD COLUMN pdf_status TEXT NOT NULL DEFAULT 'PENDING'");
if(!hasColumn('pedidos','pdf_error')) db.exec("ALTER TABLE pedidos ADD COLUMN pdf_error TEXT");
if(!hasColumn('audit_logs','integrity_hash')) db.exec("ALTER TABLE audit_logs ADD COLUMN integrity_hash TEXT");
db.exec(`
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
`);


export const id=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
export function one(sql,params=[]){return db.prepare(sql).get(...params)??null}
export function all(sql,params=[]){return db.prepare(sql).all(...params)}
export function run(sql,params=[]){return db.prepare(sql).run(...params)}
export function tx(fn){db.exec('BEGIN IMMEDIATE');try{const v=fn();db.exec('COMMIT');return v}catch(e){try{db.exec('ROLLBACK')}catch{};throw e}}
export function audit({userId,action,entity,entityId,before=null,after=null,ip='',ua=''}){
 const prev=one('SELECT integrity_hash FROM audit_logs ORDER BY created_at DESC,rowid DESC LIMIT 1')?.integrity_hash||'';
 const payload=JSON.stringify({prev,userId:userId||null,action,entity,entityId:entityId||null,before,after,ip,ua});
 const integrity_hash=crypto.createHash('sha256').update(payload).digest('hex');
 run(`INSERT INTO audit_logs(id,user_id,action,entity,entity_id,before_json,after_json,ip,user_agent,integrity_hash) VALUES(?,?,?,?,?,?,?,?,?,?)`,[id(),userId||null,action,entity,entityId||null,before?JSON.stringify(before):null,after?JSON.stringify(after):null,ip,ua,integrity_hash]);
}
