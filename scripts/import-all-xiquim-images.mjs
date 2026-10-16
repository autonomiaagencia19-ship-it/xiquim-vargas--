import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  extractBrand,
  extractFlavor,
  extractSize,
  extractQuantity,
  extractUnit,
  estimateProductPrice,
  generateProductDescription
} from './catalog-generator-helpers.mjs';

const ROOT = path.resolve(process.cwd());
const STORAGE = path.resolve('storage');
const renDir = path.join(ROOT, 'xiquim_imagens_renomeadas');
const dbPath = path.join(STORAGE, 'xiquim-vargas.db');
const manifestPath = path.join(ROOT, 'catalog', 'catalog-manifest.csv');
const storageImagesDir = path.join(STORAGE, 'product-images');

console.log('=== Início da Importação de Imagens e Descrições (xiquim_imagens_renomeadas) ===\n');

// 1. Backup do banco antes de qualquer alteração
const backupDir = path.join(STORAGE, 'backups', new Date().toISOString().slice(0, 10));
fs.mkdirSync(backupDir, { recursive: true });
const backupFile = path.join(backupDir, `xiquim-vargas.pre-import-${Date.now()}.db`);
fs.copyFileSync(dbPath, backupFile);
console.log(`[Backup] Banco de dados salvo em: ${backupFile}`);

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

// 2. Garantir subcategorias e categorias
const cats = db.prepare('SELECT id, nome, slug FROM categorias').all();
const catMap = new Map(cats.map(c => [c.nome, c.id]));

// Subcategoria Higiene & Limpeza em Descartáveis & Utilidades
const descUtilId = catMap.get('Descartáveis & Utilidades');
let higieneSub = db.prepare("SELECT id FROM subcategorias WHERE categoria_id=? AND slug='higiene-limpeza'").get(descUtilId);
if (!higieneSub) {
  const hId = crypto.randomUUID();
  db.prepare("INSERT INTO subcategorias(id, categoria_id, nome, slug, ordem, ativo) VALUES(?, ?, 'Higiene & Limpeza', 'higiene-limpeza', 2, 1)").run(hId, descUtilId);
  console.log(`[Categorias] Subcategoria 'Higiene & Limpeza' criada com id ${hId}`);
}

const subs = db.prepare('SELECT id, categoria_id, nome, slug FROM subcategorias').all();
const subMap = new Map(subs.map(s => [`${s.categoria_id}::${s.nome}`, s.id]));

function categorize(name) {
  const n = name.toLowerCase();

  // 1. Descartáveis & Utilidades / Higiene & Limpeza
  if (n.includes('sabonete') || n.includes('sabao') || n.includes('sabão') || n.includes('detergente') || 
      n.includes('tixan') || n.includes('agua sanitaria') || n.includes('água sanitária') || 
      n.includes('creme dental') || n.includes('sorriso') || n.includes('rexona') || 
      n.includes('desodorante') || n.includes('papel hig') || n.includes('barbear') || 
      n.includes('lâmina') || n.includes('lamina') || n.includes('wilkinson') || n.includes('alvejado')) {
    return { cat: 'Descartáveis & Utilidades', sub: 'Higiene & Limpeza' };
  }
  if (n.includes('copo') || n.includes('saco de papel') || n.includes('guardanapo') || 
      n.includes('prato') || n.includes('garrafa plástica') || n.includes('garrafa plastica') || 
      n.includes('sobretampa') || n.includes('descart') || n.includes('ultra copos') || n.includes('totalplast')) {
    return { cat: 'Descartáveis & Utilidades', sub: 'Copos & Sacos Descartáveis' };
  }
  if (n.includes('carvão') || n.includes('carvao') || n.includes('isqueiro') || n.includes('bic') || 
      n.includes('pilha') || n.includes('rayovac') || n.includes('copel') || n.includes('tek bond') || 
      n.includes('cola') || n.includes('fósforo') || n.includes('fosforo') || n.includes('zomo') || n.includes('seda')) {
    return { cat: 'Descartáveis & Utilidades', sub: 'Carvão & Utilidades' };
  }

  // 2. Destilados & Aperitivos
  if (n.includes('whisky') || n.includes('whiskey') || n.includes('chivas') || n.includes('johnnie walker') || 
      n.includes('jack daniel') || n.includes('white horse') || n.includes('passport') || n.includes('old eight') || 
      n.includes('royal blue') || n.includes('red label') || n.includes('black label')) {
    return { cat: 'Destilados & Aperitivos', sub: 'Whiskies' };
  }
  if (n.includes('vodka') || n.includes('absolut') || n.includes('smirnoff') || n.includes('orloff') || 
      n.includes('skyy') || n.includes('raykoff') || n.includes('stillu') || n.includes('stillus') || 
      n.includes('mansão maromba vodka')) {
    return { cat: 'Destilados & Aperitivos', sub: 'Vodkas' };
  }
  if (n.includes('cachaça') || n.includes('cachaca') || n.includes('aguardente') || n.includes('51') || 
      n.includes('engenho da terra') || n.includes('old cesar') || n.includes('alcatrão') || n.includes('alcatrao') || 
      n.includes('são joão da barra') || n.includes('sao joao da barra')) {
    return { cat: 'Destilados & Aperitivos', sub: 'Cachaças & Aguardentes' };
  }
  if (n.includes('rum ') || n.includes('rum,') || n.includes('bacardi') || n.includes('montilla') || 
      n.includes('tequila') || n.includes('jose cuervo') || n.includes('mojito')) {
    return { cat: 'Destilados & Aperitivos', sub: 'Rums & Tequilas' };
  }
  if (n.includes('gin ') || n.includes('gin') || n.includes('tanqueray') || n.includes('abracadabra') || 
      n.includes('aperitivo') || n.includes('licor') || n.includes('aperol') || n.includes('paratudo') || 
      n.includes('paratuaba') || n.includes('pará do norte') || n.includes('para do norte') || 
      n.includes('chanceler') || n.includes('conhaque') || n.includes('dreher') || n.includes('catuaba') || 
      n.includes('busca brisa') || n.includes('bananinha boah') || n.includes('maromba') || n.includes('mel e pequi')) {
    return { cat: 'Destilados & Aperitivos', sub: 'Licores, Conhaques & Aperitivos' };
  }

  // 3. Cervejas & Drinks Prontos
  if (n.includes('cerveja') || n.includes('heineken') || n.includes('brahma') || n.includes('skol') || 
      n.includes('amstel') || n.includes('stempel') || n.includes('corona') || n.includes('budweiser') || 
      n.includes('eisenbahn') || n.includes('draft')) {
    return { cat: 'Cervejas & Drinks Prontos', sub: 'Cervejas' };
  }
  if (n.includes('drink') || n.includes('drinkball') || n.includes('ice') || n.includes('beats') || 
      n.includes('syn') || n.includes('smirnoff ice') || n.includes('corote') || n.includes('paratini') || 
      n.includes('s cantina') || n.includes('coquetel')) {
    if (n.includes('vinho') || n.includes('cantina') || n.includes('paratini') || n.includes('coquetel composto')) {
      return { cat: 'Vinhos & Coquetéis', sub: 'Coquetéis & Aperitivos de Vinho' };
    }
    return { cat: 'Cervejas & Drinks Prontos', sub: 'Drinks Prontos & Ice' };
  }

  // 4. Vinhos & Coquetéis
  if (n.includes('vinho') || n.includes('pergola') || n.includes('pérgola') || n.includes('santille') || 
      n.includes('pink moon') || n.includes('frisante') || n.includes('espumante') || n.includes('reservado') || 
      n.includes('campo largo') || n.includes('sangue de boi') || n.includes('jurupinga')) {
    if (n.includes('frisante') || n.includes('coquetel') || n.includes('pink moon')) {
      return { cat: 'Vinhos & Coquetéis', sub: 'Coquetéis & Aperitivos de Vinho' };
    }
    return { cat: 'Vinhos & Coquetéis', sub: 'Vinhos Finos & Mesa' };
  }

  // 5. Energéticos
  if (n.includes('energético') || n.includes('energetico') || n.includes('energy drink') || 
      n.includes('monster') || n.includes('red bull') || n.includes('redbull') || n.includes('red hot') || 
      n.includes('hitspower') || n.includes('hits power') || n.includes('paranight') || n.includes('bally')) {
    if (n.includes('2l') || n.includes('2 litros') || n.includes('pet')) {
      return { cat: 'Energéticos', sub: 'Energéticos Pet 2L' };
    }
    return { cat: 'Energéticos', sub: 'Energéticos Lata 473ml' };
  }

  // 6. Refrigerantes
  if (n.includes('refrigerante') || n.includes('coca') || n.includes('fanta') || n.includes('sprite') || 
      n.includes('guaraná') || n.includes('guarana') || n.includes('iate') || n.includes('uai') || 
      n.includes('pepsi') || n.includes('sukita') || n.includes('schin') || n.includes('tubaína') || 
      n.includes('h2oh') || n.includes('mineiro') || n.includes('soda')) {
    if (n.includes('lata') || n.includes('200ml') || n.includes('250ml') || n.includes('350ml') || n.includes('mini')) {
      return { cat: 'Refrigerantes', sub: 'Refrigerantes em Lata & Mini' };
    }
    return { cat: 'Refrigerantes', sub: 'Refrigerantes Garrafa & 2L' };
  }

  // 7. Sucos, Águas & Chás
  if (n.includes('água') || n.includes('agua') || n.includes('lindoya') || n.includes('gatorade') || 
      n.includes('isotônico') || n.includes('isotonico')) {
    return { cat: 'Sucos, Águas & Chás', sub: 'Águas & Isotônicos' };
  }
  if (n.includes('suco') || n.includes('del valle') || n.includes('tikito') || n.includes('leko') || 
      n.includes('integral') || n.includes('nectar') || n.includes('néctar') || n.includes('bebida láctea') || 
      n.includes('bebida lactea') || n.includes('ibituruna') || n.includes('leite')) {
    return { cat: 'Sucos, Águas & Chás', sub: 'Sucos Prontos & Integrais' };
  }
  if (n.includes('fresh') || n.includes('xarope') || n.includes('tang') || n.includes('camp') || 
      n.includes('fit') || n.includes('monin')) {
    return { cat: 'Sucos, Águas & Chás', sub: 'Refrescos em Pó & Xaropes' };
  }

  // 8. Doces & Gomas
  if (n.includes('chocolate') || n.includes('bombom') || n.includes('trento') || n.includes('baton') || 
      n.includes('garoto') || n.includes('nestlé') || n.includes('nestle') || n.includes('chokito') || 
      n.includes('prestígio') || n.includes('prestigio') || n.includes('kit kat') || n.includes('nutella') || 
      n.includes('nucita') || n.includes('amassaxup') || n.includes('toddy') || n.includes('achocolatado') || 
      n.includes('biscoito') || n.includes('wafer')) {
    return { cat: 'Doces & Gomas', sub: 'Chocolates & Bombons' };
  }
  if (n.includes('chicle') || n.includes('chiclete') || n.includes('trident') || n.includes('bubbaloo') || 
      n.includes('big big') || n.includes('flics') || n.includes('plutonita') || n.includes('goma') || 
      n.includes('gomets') || n.includes('gelatina') || n.includes('fini') || n.includes('docile') || 
      n.includes('terror zone') || n.includes('mentos')) {
    return { cat: 'Doces & Gomas', sub: 'Gomas & Chicletes' };
  }
  if (n.includes('bala') || n.includes('pirulito') || n.includes('freegells') || n.includes('halls') || 
      n.includes('ice kiss') || n.includes('fruit-tella') || n.includes('diploko') || n.includes('dum dum') || 
      n.includes('blong') || n.includes('kantada') || n.includes('santa rita') || n.includes('passtilha') || 
      n.includes('spray doce')) {
    return { cat: 'Doces & Gomas', sub: 'Gomas & Chicletes' };
  }
  if (n.includes('doce') || n.includes('paçoca') || n.includes('pacoca') || n.includes('paçoquinha') || 
      n.includes('pacoquinha') || n.includes('pé de moleque') || n.includes('pe de moleque') || 
      n.includes('pé de moça') || n.includes('pe de moca') || n.includes('cocada') || n.includes('bananada') || 
      n.includes('fondant') || n.includes('marshmallow') || n.includes('gibi') || n.includes('cajuzinho') || 
      n.includes('palha italiana') || n.includes('pingo bel') || n.includes('resende') || n.includes('vitalidade') || 
      n.includes('geleia de mocoto') || n.includes('geleia de mocotó') || n.includes('quebra queixo') || 
      n.includes('ouro de minas') || n.includes('mindy') || n.includes('doces')) {
    return { cat: 'Doces & Gomas', sub: 'Chocolates & Bombons' };
  }

  // 9. Petiscos & Mercearia
  if (n.includes('batata') || n.includes('amendoim') || n.includes('salgadinho') || n.includes('torcida') || 
      n.includes('click') || n.includes('super click') || n.includes('sport click') || n.includes('gulão') || 
      n.includes('gulao') || n.includes('pururuca') || n.includes('torresmo') || n.includes('torresminho') || 
      n.includes('pipoca') || n.includes('yoki') || n.includes('banana chips') || n.includes('banananinha') || 
      n.includes('polvilho') || n.includes('crocante')) {
    return { cat: 'Petiscos & Mercearia', sub: 'Batatas, Amendoins & Salgadinhos' };
  }
  if (n.includes('molho') || n.includes('shoyu') || n.includes('sunakku') || n.includes('extrato de tomate') || 
      n.includes('tempero') || n.includes('corante') || n.includes('vovó dolores') || n.includes('azeitona') || 
      n.includes('vinagre') || n.includes('sazón') || n.includes('sazon') || n.includes('mostarda') || 
      n.includes('ketchup') || n.includes('maionese')) {
    return { cat: 'Petiscos & Mercearia', sub: 'Molhos & Condimentos' };
  }
  if (n.includes('conserva') || n.includes('sardinha') || n.includes('nautique') || n.includes('salsicha') || 
      n.includes('frisa') || n.includes('sal ') || n.includes('salmor') || n.includes('salmorão') || 
      n.includes('milho em conserva') || n.includes('palmito') || n.includes('açúcar') || n.includes('acucar')) {
    return { cat: 'Petiscos & Mercearia', sub: 'Conservas & Sal' };
  }
  if (n.includes('macarrão') || n.includes('macarrao') || n.includes('renata') || n.includes('roberta') || 
      n.includes('parafuso') || n.includes('caracolino') || n.includes('farinha') || n.includes('arroz') || 
      n.includes('feijão') || n.includes('feijao') || n.includes('azeite') || n.includes('óleo') || n.includes('oleo') || 
      n.includes('queijo')) {
    return { cat: 'Petiscos & Mercearia', sub: 'Conservas & Sal' };
  }

  return { cat: 'Petiscos & Mercearia', sub: 'Batatas, Amendoins & Salgadinhos' };
}

// 3. Ler todos os arquivos de xiquim_imagens_renomeadas e agrupar
const files = fs.readdirSync(renDir).filter(f => f.toLowerCase().endsWith('.jpg'));
console.log(`[Imagens] ${files.length} arquivos JPG encontrados na pasta.`);

const productsMap = new Map();

for (const f of files) {
  let base = f.replace(/\.jpg$/i, '').trim().replace(/\s+/g, ' ');
  let cleanName = base;
  let isSecondary = false;

  const mParen = cleanName.match(/^(.+?)\s*\(([0-9]+)\)$/);
  if (mParen) {
    cleanName = mParen[1].trim();
    if (mParen[2] !== '1') isSecondary = true;
  } else {
    const mNum = cleanName.match(/^(.+?)\s+([1-4])$/);
    if (mNum) {
      cleanName = mNum[1].trim();
      if (mNum[2] !== '1') isSecondary = true;
    }
  }

  if (!productsMap.has(cleanName)) {
    productsMap.set(cleanName, {
      name: cleanName,
      images: []
    });
  }
  productsMap.get(cleanName).images.push({
    file: f,
    originalName: base,
    isSecondary
  });
}

// Ordena imagens para garantir a principal primeiro
for (const [name, p] of productsMap.entries()) {
  p.images.sort((a, b) => {
    if (a.isSecondary && !b.isSecondary) return 1;
    if (!a.isSecondary && b.isSecondary) return -1;
    return a.file.localeCompare(b.file);
  });
}

console.log(`[Agrupamento] Total de ${productsMap.size} produtos únicos identificados.`);

// 4. Calcular sequência de SKU e Código de Barras
const maxSkuRow = db.prepare("SELECT sku FROM produtos WHERE sku LIKE 'XQ-%' ORDER BY CAST(substr(sku, 4) AS INTEGER) DESC LIMIT 1").get();
let nextSkuNum = 1;
if (maxSkuRow && maxSkuRow.sku) {
  const numPart = parseInt(maxSkuRow.sku.replace('XQ-', ''), 10);
  if (!isNaN(numPart)) nextSkuNum = numPart + 1;
}

const maxBarcodeRow = db.prepare("SELECT codigo_barras FROM produtos WHERE codigo_barras LIKE '7890000%' ORDER BY CAST(codigo_barras AS INTEGER) DESC LIMIT 1").get();
let nextBarcodeNum = 1;
if (maxBarcodeRow && maxBarcodeRow.codigo_barras) {
  const numPart = parseInt(maxBarcodeRow.codigo_barras.replace('7890000', ''), 10);
  if (!isNaN(numPart)) nextBarcodeNum = numPart + 1;
}

console.log(`[Sequenciamento] Próximo SKU inicial: XQ-${String(nextSkuNum).padStart(4, '0')}`);
console.log(`[Sequenciamento] Próximo Código de Barras inicial: 7890000${String(nextBarcodeNum).padStart(6, '0')}`);

// 5. Preparar inserções
fs.mkdirSync(storageImagesDir, { recursive: true });

const existingProds = db.prepare('SELECT id, nome FROM produtos').all();
const existingByName = new Map(existingProds.map(p => [p.nome.toLowerCase().trim(), p.id]));

const insertProdStmt = db.prepare(`
  INSERT INTO produtos(id, nome, sku, codigo_barras, marca, sabor, tamanho, unidade, descricao, foto_url, categoria_id, subcategoria_id, preco_base, ativo, esgotado)
  VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
`);

const insertImgStmt = db.prepare(`
  INSERT INTO produto_imagens(id, produto_id, arquivo_path, mime_type, tamanho_bytes, principal, ordem)
  VALUES(?, ?, ?, 'image/jpeg', ?, ?, ?)
`);

const insertEstoqueStmt = db.prepare(`
  INSERT INTO estoque(produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo)
  VALUES(?, ?, 0, ?)
`);

const insertTabelaPrecoStmt = db.prepare(`
  INSERT INTO tabela_preco_itens(id, tabela_id, produto_id, preco, quantidade_minima)
  VALUES(?, ?, ?, ?, ?)
`);

const adminId = db.prepare("SELECT id FROM usuarios WHERE role='admin' LIMIT 1").get()?.id || null;

const insertAuditStmt = db.prepare(`
  INSERT INTO audit_logs(id, user_id, action, entity, entity_id, after_json)
  VALUES(?, ?, 'IMPORT_PRODUCT_CATALOG', 'produto', ?, ?)
`);

let insertedProducts = 0;
let attachedImages = 0;
const manifestRowsToAppend = [];

db.exec('BEGIN TRANSACTION;');

try {
  for (const [prodName, prodData] of productsMap.entries()) {
    const existingId = existingByName.get(prodName.toLowerCase().trim());
    const pid = existingId || crypto.randomUUID();

    const brand = extractBrand(prodName);
    const flavor = extractFlavor(prodName);
    const size = extractSize(prodName);
    const quantity = extractQuantity(prodName);
    const unit = extractUnit(prodName);

    const { cat, sub } = categorize(prodName);
    const catId = catMap.get(cat);
    const subId = subMap.get(`${catId}::${sub}`) || null;

    const precoBase = estimateProductPrice(prodName, cat, sub);
    const descricao = generateProductDescription(prodName, cat, sub, brand, flavor, size, unit, quantity);

    const sku = `XQ-${String(nextSkuNum++).padStart(4, '0')}`;
    const barcode = `7890000${String(nextBarcodeNum++).padStart(6, '0')}`;

    if (!existingId) {
      // 1. Inserir produto primeiro para satisfazer chave estrangeira de produto_imagens
      insertProdStmt.run(
        pid,
        prodName,
        sku,
        barcode,
        brand,
        flavor,
        size,
        unit,
        descricao,
        null, // foto_url será atualizada com a imagem principal
        catId,
        subId,
        precoBase
      );

      // 2. Estoque saudável
      const qtdEstoque = Math.floor(Math.random() * 350) + 120;
      const estoqueMinimo = Math.floor(qtdEstoque * 0.15);
      insertEstoqueStmt.run(pid, qtdEstoque, estoqueMinimo);

      // 3. Preços das 3 tabelas
      const precoAtacado = Math.round(precoBase * 0.85 * 100) / 100;
      const precoBares = Math.round(precoBase * 0.90 * 100) / 100;
      const precoConv = Math.round(precoBase * 0.92 * 100) / 100;

      insertTabelaPrecoStmt.run(crypto.randomUUID(), 'tab-atacado-ouro', pid, precoAtacado, 6);
      insertTabelaPrecoStmt.run(crypto.randomUUID(), 'tab-bares-noturnos', pid, precoBares, 3);
      insertTabelaPrecoStmt.run(crypto.randomUUID(), 'tab-conveniencias', pid, precoConv, 1);

      insertAuditStmt.run(crypto.randomUUID(), adminId, pid, JSON.stringify({ nome: prodName, sku, precoBase, cat, sub }));
      insertedProducts++;
    }

    // Processar imagens
    const prodImgDir = path.join(storageImagesDir, pid);
    fs.mkdirSync(prodImgDir, { recursive: true });

    let primaryFotoUrl = null;

    prodData.images.forEach((imgInfo, imgIdx) => {
      const imgId = crypto.randomUUID();
      const sourceFile = path.join(renDir, imgInfo.file);
      const targetFile = path.join(prodImgDir, `${imgId}.jpg`);
      fs.copyFileSync(sourceFile, targetFile);

      const stat = fs.statSync(targetFile);
      const relativePath = `product-images/${pid}/${imgId}.jpg`;
      const fotoUrl = `/media/product-images/${pid}/${imgId}.jpg`;
      const isPrincipal = (imgIdx === 0) ? 1 : 0;

      if (isPrincipal) primaryFotoUrl = fotoUrl;

      insertImgStmt.run(imgId, pid, relativePath, stat.size, isPrincipal, imgIdx);
      attachedImages++;

      manifestRowsToAppend.push({
        produto_id: pid,
        sku,
        nome: prodName,
        descricao,
        preco_base: precoBase.toFixed(2),
        precificacao: 'PRECO_ESTIMADO',
        categoria: cat,
        arquivo_origem: imgInfo.file,
        image_id: imgId,
        arquivo_catalogo: relativePath,
        principal: isPrincipal ? 'SIM' : 'NAO'
      });
    });

    if (primaryFotoUrl) {
      db.prepare('UPDATE produtos SET foto_url=? WHERE id=?').run(primaryFotoUrl, pid);
    }
  }

  db.exec('COMMIT;');
  console.log(`\n[Sucesso] ${insertedProducts} novos produtos inseridos no catálogo.`);
  console.log(`[Sucesso] ${attachedImages} imagens copiadas para storage/product-images e cadastradas no banco.`);

} catch (err) {
  db.exec('ROLLBACK;');
  console.error('[Erro Fatal] Falha ao importar produtos, rollback executado:', err);
  throw err;
}

// 6. Atualizar manifest CSV
if (fs.existsSync(manifestPath)) {
  const csvLines = manifestRowsToAppend.map(r => 
    `"${r.produto_id}","${r.sku}","${r.nome.replace(/"/g, '""')}","${r.descricao.replace(/"/g, '""')}","${r.preco_base}","${r.precificacao}","${r.categoria}","${r.arquivo_origem.replace(/"/g, '""')}","${r.image_id}","${r.arquivo_catalogo}","${r.principal}"`
  );
  fs.appendFileSync(manifestPath, '\n' + csvLines.join('\n'), 'utf-8');
  console.log(`[Manifest] ${csvLines.length} registros anexados a ${manifestPath}`);
}

console.log('\n=== Carga Concluída com Total Integridade! ===');
