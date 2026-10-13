import fs from 'node:fs';
import path from 'node:path';
import { run, tx, id, all, one, STORAGE, ROOT } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

console.log('=== Iniciando Carga Completa de Demonstração (Xiquim Vargas ERP) ===\n');

const defaultPassword = hashPassword('ChangeMe123!');

// Bairros e coordenadas de Governador Valadares (MG)
const bairrosGV = [
  { nome: 'Centro', lat: -18.8542, lng: -41.9515 },
  { nome: 'Ilha dos Araújos', lat: -18.8590, lng: -41.9420 },
  { nome: 'Vila Bretas', lat: -18.8450, lng: -41.9600 },
  { nome: 'Santa Rita', lat: -18.8680, lng: -41.9580 },
  { nome: 'Lourdes', lat: -18.8620, lng: -41.9350 },
  { nome: 'São Paulo', lat: -18.8500, lng: -41.9380 },
  { nome: 'Grã-Duquesa', lat: -18.8710, lng: -41.9300 },
  { nome: 'Morada do Acampamento', lat: -18.8750, lng: -41.9250 },
  { nome: 'Altinópolis', lat: -18.8320, lng: -41.9700 },
  { nome: 'Castanheiras', lat: -18.8250, lng: -41.9650 },
  { nome: 'Carapina', lat: -18.8730, lng: -41.9620 },
  { nome: 'Esplanada', lat: -18.8480, lng: -41.9720 },
  { nome: 'Esperança', lat: -18.8380, lng: -41.9620 },
  { nome: 'Santa Paula', lat: -18.8520, lng: -41.9800 },
  { nome: 'Sir', lat: -18.8180, lng: -41.9850 },
  { nome: 'Turmalina', lat: -18.8150, lng: -41.9750 },
  { nome: 'Vila Mariana', lat: -18.8560, lng: -41.9850 }
];

const rotasMapping = [
  { nome: 'Rota 01 - Centro e Ilha', bairros: ['Centro', 'Ilha dos Araújos', 'São Paulo'] },
  { nome: 'Rota 02 - Sul', bairros: ['Vila Bretas', 'Santa Rita', 'Carapina'] },
  { nome: 'Rota 03 - Leste', bairros: ['Lourdes', 'Grã-Duquesa', 'Morada do Acampamento'] },
  { nome: 'Rota 04 - Norte', bairros: ['Altinópolis', 'Castanheiras', 'Esperança'] },
  { nome: 'Rota 05 - Oeste', bairros: ['Esplanada', 'Santa Paula', 'Vila Mariana'] },
  { nome: 'Rota 06 - Expansão', bairros: ['Sir', 'Turmalina'] }
];

// Categorias e Subcategorias com slugs amigáveis
const categoryDefinitions = [
  {
    nome: 'Destilados & Aperitivos',
    slug: 'destilados-aperitivos',
    subcategorias: [
      { nome: 'Whiskies', slug: 'whiskies' },
      { nome: 'Vodkas', slug: 'vodkas' },
      { nome: 'Cachaças & Aguardentes', slug: 'cachacas-aguardentes' },
      { nome: 'Rums & Tequilas', slug: 'rums-tequilas' },
      { nome: 'Licores, Conhaques & Aperitivos', slug: 'licores-conhaques' }
    ]
  },
  {
    nome: 'Cervejas & Drinks Prontos',
    slug: 'cervejas-drinks',
    subcategorias: [
      { nome: 'Cervejas', slug: 'cervejas' },
      { nome: 'Drinks Prontos & Ice', slug: 'drinks-prontos-ice' }
    ]
  },
  {
    nome: 'Refrigerantes',
    slug: 'refrigerantes',
    subcategorias: [
      { nome: 'Refrigerantes em Lata & Mini', slug: 'refrigerantes-lata-mini' },
      { nome: 'Refrigerantes Garrafa & 2L', slug: 'refrigerantes-garrafa-2l' }
    ]
  },
  {
    nome: 'Energéticos',
    slug: 'energeticos',
    subcategorias: [
      { nome: 'Energéticos Lata 473ml', slug: 'energeticos-lata-473ml' },
      { nome: 'Energéticos Pet 2L', slug: 'energeticos-pet-2l' }
    ]
  },
  {
    nome: 'Vinhos & Coquetéis',
    slug: 'vinhos-coqueteis',
    subcategorias: [
      { nome: 'Vinhos Finos & Mesa', slug: 'vinhos-finos-mesa' },
      { nome: 'Coquetéis & Aperitivos de Vinho', slug: 'coqueteis-aperitivos-vinho' }
    ]
  },
  {
    nome: 'Sucos, Águas & Chás',
    slug: 'sucos-aguas-chas',
    subcategorias: [
      { nome: 'Sucos Prontos & Integrais', slug: 'sucos-prontos-integrais' },
      { nome: 'Refrescos em Pó & Xaropes', slug: 'refrescos-po-xaropes' },
      { nome: 'Águas & Isotônicos', slug: 'aguas-isotonicos' }
    ]
  },
  {
    nome: 'Doces & Gomas',
    slug: 'doces-gomas',
    subcategorias: [
      { nome: 'Chocolates & Bombons', slug: 'chocolates-bombons' },
      { nome: 'Gomas & Chicletes', slug: 'gomas-chicletes' }
    ]
  },
  {
    nome: 'Petiscos & Mercearia',
    slug: 'petiscos-mercearia',
    subcategorias: [
      { nome: 'Batatas, Amendoins & Salgadinhos', slug: 'batatas-salgadinhos' },
      { nome: 'Molhos & Condimentos', slug: 'molhos-condimentos' },
      { nome: 'Conservas & Sal', slug: 'conservas-sal' }
    ]
  },
  {
    nome: 'Descartáveis & Utilidades',
    slug: 'descartaveis-utilidades',
    subcategorias: [
      { nome: 'Copos & Sacos Descartáveis', slug: 'copos-sacos-descartaveis' },
      { nome: 'Carvão & Utilidades', slug: 'carvao-utilidades' }
    ]
  }
];

function categorize(name) {
  const n = name.toLowerCase();
  if (n.includes('whisky') || n.includes('vodka') || n.includes('aguardente') || n.includes('cachaça') || n.includes('rum ') || n.includes('conhaque') || n.includes('tequila') || n.includes('licor') || n.includes('catuaba') || n.includes('aperitivo') || n.includes('chanceler') || n.includes('busca brisa') || n.includes('melzinho') || n.includes('mansão maromba')) {
    return 'Destilados & Aperitivos';
  }
  if (n.includes('cerveja') || n.includes('heineken') || n.includes('beats') || n.includes('drinkball') || n.includes('black night')) {
    return 'Cervejas & Drinks Prontos';
  }
  if (n.includes('refrigerante') || n.includes('coca-cola') || n.includes('fanta') || n.includes('sprite') || n.includes('iate') || n.includes('uai') || n.includes('h2oh')) {
    return 'Refrigerantes';
  }
  if (n.includes('energético') || n.includes('hitspower') || n.includes('monster') || n.includes('red hot')) {
    return 'Energéticos';
  }
  if (n.includes('vinho') || n.includes('martini') || n.includes('jurupinga') || n.includes('coquetel')) {
    return 'Vinhos & Coquetéis';
  }
  if (n.includes('suco') || n.includes('del valle') || n.includes('fresh') || n.includes('tikito') || n.includes('água') || n.includes('gatorade') || n.includes('xarope')) {
    return 'Sucos, Águas & Chás';
  }
  if (n.includes('trident') || n.includes('bubbaloo') || n.includes('bombom') || n.includes('kit kat')) {
    return 'Doces & Gomas';
  }
  if (n.includes('copo') || n.includes('saco') || n.includes('carvão') || n.includes('álcool') || n.includes('cola tek') || n.includes('vinagre')) {
    return 'Descartáveis & Utilidades';
  }
  return 'Petiscos & Mercearia';
}

function subcategorize(prodName, catName) {
  const n = prodName.toLowerCase();
  if (catName === 'Destilados & Aperitivos') {
    if (n.includes('whisky') || n.includes('old eight') || n.includes('royal blue') || n.includes('chivas') || n.includes('jack daniel') || n.includes('johnnie walker') || n.includes('passport') || n.includes('white horse') || n.includes('cowboy')) return 'Whiskies';
    if (n.includes('vodka') || n.includes('absolut') || n.includes('orloff') || n.includes('raykoff') || n.includes('skyy') || n.includes('smirnoff') || n.includes('stillus')) return 'Vodkas';
    if (n.includes('aguardente') || n.includes('cachaça') || n.includes('alcatrão') || n.includes('engenho da terra') || n.includes('old cesar') || n.includes('51')) return 'Cachaças & Aguardentes';
    if (n.includes('rum ') || n.includes('bacardi') || n.includes('montilla') || n.includes('tequila') || n.includes('jose cuervo')) return 'Rums & Tequilas';
    return 'Licores, Conhaques & Aperitivos';
  }
  if (catName === 'Cervejas & Drinks Prontos') {
    if (n.includes('cerveja') || n.includes('heineken')) return 'Cervejas';
    return 'Drinks Prontos & Ice';
  }
  if (catName === 'Refrigerantes') {
    if (n.includes('lata') || n.includes('mini pet') || n.includes('200ml') || n.includes('350ml')) return 'Refrigerantes em Lata & Mini';
    return 'Refrigerantes Garrafa & 2L';
  }
  if (catName === 'Energéticos') {
    if (n.includes('2l')) return 'Energéticos Pet 2L';
    return 'Energéticos Lata 473ml';
  }
  if (catName === 'Vinhos & Coquetéis') {
    if (n.includes('vinho reservado') || n.includes('pérgola') || n.includes('são pasqual') || n.includes('casa rodrigues')) return 'Vinhos Finos & Mesa';
    return 'Coquetéis & Aperitivos de Vinho';
  }
  if (catName === 'Sucos, Águas & Chás') {
    if (n.includes('água') || n.includes('gatorade')) return 'Águas & Isotônicos';
    if (n.includes('fresh') || n.includes('xarope')) return 'Refrescos em Pó & Xaropes';
    return 'Sucos Prontos & Integrais';
  }
  if (catName === 'Doces & Gomas') {
    if (n.includes('bombom') || n.includes('kit kat')) return 'Chocolates & Bombons';
    return 'Gomas & Chicletes';
  }
  if (catName === 'Petiscos & Mercearia') {
    if (n.includes('molho') || n.includes('tempero sazón')) return 'Molhos & Condimentos';
    if (n.includes('milho') || n.includes('sal ') || n.includes('sal salmonete') || n.includes('açúcar')) return 'Conservas & Sal';
    return 'Batatas, Amendoins & Salgadinhos';
  }
  if (catName === 'Descartáveis & Utilidades') {
    if (n.includes('carvão') || n.includes('cola') || n.includes('vinagre') || n.includes('álcool')) return 'Carvão & Utilidades';
    return 'Copos & Sacos Descartáveis';
  }
  return null;
}

function estimatePrice(name) {
  const n = name.toLowerCase();
  if (n.includes('johnnie walker') || n.includes('chivas') || n.includes('jack daniel')) return 119.90;
  if (n.includes('white horse') || n.includes('passport') || n.includes('absolut')) return 79.90;
  if (n.includes('jose cuervo')) return 89.90;
  if (n.includes('bacardi') || n.includes('smirnoff') || n.includes('skyy') || n.includes('orloff')) return 44.90;
  if (n.includes('dreher') || n.includes('presidente') || n.includes('51') || n.includes('alcatrão') || n.includes('old eight')) return 22.90;
  if (n.includes('engenho da terra 2l')) return 26.90;
  if (n.includes('engenho da terra')) return 12.90;
  if (n.includes('catuaba') || n.includes('jurupinga') || n.includes('pérgola')) return 19.90;
  if (n.includes('concha y toro') || n.includes('reservado')) return 39.90;
  if (n.includes('amarula')) return 109.90;
  if (n.includes('licor stock')) return 36.90;
  if (n.includes('monster')) return 11.50;
  if (n.includes('red hot 2l') || n.includes('hits power 2l') || n.includes('hitspower 2l')) return 14.90;
  if (n.includes('energético') || n.includes('hitspower') || n.includes('red hot')) return 8.90;
  if (n.includes('heineken') && n.includes('fardo')) return 42.00;
  if (n.includes('heineken')) return 7.50;
  if (n.includes('beats')) return 6.90;
  if (n.includes('coca-cola 2l') || n.includes('coca-cola 2l fardo')) return 11.50;
  if (n.includes('coca-cola lata') || n.includes('coca-cola zero')) return 4.50;
  if (n.includes('refrigerante') && n.includes('2l')) return 6.90;
  if (n.includes('refrigerante') || n.includes('fanta') || n.includes('sprite')) return 4.50;
  if (n.includes('batata palha 800g') || n.includes('molho') && n.includes('3kg')) return 28.90;
  if (n.includes('batata palha') || n.includes('amendoim mendorato')) return 14.90;
  if (n.includes('batata magu')) return 4.90;
  if (n.includes('trident cx') || n.includes('bubbaloo cx') || n.includes('kit kat cx')) return 34.90;
  if (n.includes('suco del valle') || n.includes('suco tikito') || n.includes('gatorade')) return 5.50;
  if (n.includes('carvão')) return 18.90;
  if (n.includes('copo') || n.includes('saco')) return 16.90;
  return 12.50;
}

tx(() => {
  console.log('1. Limpando dados operacionais anteriores...');
  run('DELETE FROM cliente_interacoes');
  run('DELETE FROM compra_itens');
  run('DELETE FROM compras');
  run('DELETE FROM fornecedor_produtos');
  run('DELETE FROM fornecedores');
  run('DELETE FROM comprovantes_entrega');
  run('DELETE FROM rota_pedidos');
  run('DELETE FROM rotas_logistica');
  run('DELETE FROM pedido_itens');
  run('DELETE FROM pedidos');
  run('DELETE FROM usuario_clientes');
  run("DELETE FROM clientes WHERE id != 'CLIENTE-BALCAO'");
  run('DELETE FROM rota_bairros');
  run('DELETE FROM rotas_config');
  run('DELETE FROM vendedor_rotas');
  run('DELETE FROM movimentacoes_estoque');
  run('DELETE FROM estoque');
  run('DELETE FROM produto_imagens');
  run('DELETE FROM promocoes');
  run('DELETE FROM tabela_preco_itens');
  run('DELETE FROM tabelas_preco');
  run('DELETE FROM produtos');
  run('DELETE FROM subcategorias');
  run('DELETE FROM categorias');
  run('DELETE FROM audit_logs');
  run('DELETE FROM idempotency_keys');
  run("DELETE FROM usuarios WHERE role != 'admin'");

  // Garante cliente balcão
  run(`INSERT OR IGNORE INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, endereco, bairro, cidade, estado, ativo)
       VALUES('CLIENTE-BALCAO', 'Consumidor Final (Balcão)', 'Balcão / PDV', '00.000.000/0000-00', 'Venda Direta em Loja', 'Centro', 'Governador Valadares', 'MG', 1)`);

  // Garante que exista administrador com credenciais conhecidas
  let adminId = one("SELECT id FROM usuarios WHERE email='admin@gv.local'")?.id;
  if (!adminId) {
    adminId = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, 'Administrador Central', 'admin@gv.local', ?, 'admin', 1)", [adminId, defaultPassword]);
  }

  // Configurações do Depósito Central de Governador Valadares
  run("INSERT INTO configuracoes(chave, valor) VALUES('deposito_latitude', '-18.854200') ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor");
  run("INSERT INTO configuracoes(chave, valor) VALUES('deposito_longitude', '-41.951500') ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor");
  run("INSERT INTO configuracoes(chave, valor) VALUES('store.title', 'Xiquim Vargas Distribuidora') ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor");
  run("INSERT INTO configuracoes(chave, valor) VALUES('store.subtitle', 'Bebidas, Doces e Alimentos no Atacado e Varejo') ON CONFLICT(chave) DO UPDATE SET valor=excluded.valor");

  console.log('2. Criando Usuários (10 Vendedores, 4 Caixas PDV, 6 Motoristas, 50 Clientes Web)...');
  const uVendedores = [];
  const uCaixas = [];
  const uMotoristas = [];
  const uWeb = [];

  for (let i = 1; i <= 10; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, ?, ?, ?, 'seller', 1)",
      [uid, `Vendedor GV ${i}`, `vendedor${i}@gv.local`, defaultPassword]);
    uVendedores.push({ id: uid, nome: `Vendedor GV ${i}` });
  }

  for (let i = 1; i <= 4; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, ?, ?, ?, 'cashier', 1)",
      [uid, `Caixa PDV ${i}`, `caixa${i}@gv.local`, defaultPassword]);
    uCaixas.push({ id: uid, nome: `Caixa PDV ${i}` });
  }

  for (let i = 1; i <= 6; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, ?, ?, ?, 'driver', 1)",
      [uid, `Motorista Rota ${i}`, `motorista${i}@gv.local`, defaultPassword]);
    uMotoristas.push({ id: uid, nome: `Motorista Rota ${i}` });
  }

  for (let i = 1; i <= 50; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role, ativo) VALUES(?, ?, ?, ?, 'web_client', 1)",
      [uid, `Cliente Web ${i}`, `web${i}@gv.local`, defaultPassword]);
    uWeb.push({ id: uid, nome: `Cliente Web ${i}` });
  }

  console.log('3. Criando Rotas de Logística e Designações...');
  rotasMapping.forEach((rotaConf, index) => {
    const rotaId = id();
    run("INSERT INTO rotas_config(id, nome, dia_semana) VALUES(?, ?, ?)", [rotaId, rotaConf.nome, (index % 6) + 1]);
    rotaConf.bairros.forEach(b => {
      run("INSERT INTO rota_bairros(id, rota_config_id, bairro) VALUES(?, ?, ?)", [id(), rotaId, b]);
    });
    // Vincula vendedor à rota
    run("INSERT INTO vendedor_rotas(vendedor_id, rota_config_id, dia_semana) VALUES(?, ?, ?)",
      [uVendedores[index % uVendedores.length].id, rotaId, (index % 6) + 1]);
  });

  console.log('4. Cadastrando Categorias e Subcategorias no Banco...');
  const catMap = new Map();
  const subMap = new Map(); // key: "catName::subName" -> subId

  categoryDefinitions.forEach((cDef, catIdx) => {
    const catId = id();
    run("INSERT INTO categorias(id, nome, slug, ordem, ativo) VALUES(?, ?, ?, ?, 1)", [catId, cDef.nome, cDef.slug, catIdx]);
    catMap.set(cDef.nome, catId);

    cDef.subcategorias.forEach((sDef, subIdx) => {
      const subId = id();
      run("INSERT INTO subcategorias(id, categoria_id, nome, slug, ordem, ativo) VALUES(?, ?, ?, ?, ?, 1)",
        [subId, catId, sDef.nome, sDef.slug, subIdx]);
      subMap.set(`${cDef.nome}::${sDef.nome}`, subId);
    });
  });
  console.log(`   ✓ ${catMap.size} categorias e ${subMap.size} subcategorias estruturadas com sucesso.`);

  console.log('5. Cadastrando os 191 Produtos com Imagens Reais e Subcategorias Mapeadas...');
  const imageDir = path.join(ROOT, 'descriçoes corretas');
  const files = fs.readdirSync(imageDir).filter(f => f.toLowerCase().endsWith('.jpg'));

  const storageImagesDir = path.join(STORAGE, 'product-images');
  fs.mkdirSync(storageImagesDir, { recursive: true });

  const produtosCriados = [];
  files.forEach((file, idx) => {
    const prodName = file.replace(/\.jpg$/i, '').trim();
    const catName = categorize(prodName);
    const catId = catMap.get(catName);
    const subName = subcategorize(prodName, catName);
    const subId = subMap.get(`${catName}::${subName}`) || null;
    const preco = estimatePrice(prodName);
    const sku = `XQ-${String(idx + 1).padStart(4, '0')}`;
    const barcode = `789000${String(idx + 1).padStart(7, '0')}`;
    const pid = id();

    // Copia a imagem real para storage/product-images/:pid/:imgId.jpg
    const imgId = id();
    const prodImgDir = path.join(storageImagesDir, pid);
    fs.mkdirSync(prodImgDir, { recursive: true });
    const targetFile = path.join(prodImgDir, `${imgId}.jpg`);
    const sourceFile = path.join(imageDir, file);
    fs.copyFileSync(sourceFile, targetFile);
    const stat = fs.statSync(targetFile);

    const relativePath = `product-images/${pid}/${imgId}.jpg`;
    const fotoUrl = `/media/product-images/${pid}/${imgId}.jpg`;

    run(`INSERT INTO produtos(id, nome, sku, codigo_barras, preco_base, categoria_id, subcategoria_id, foto_url, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [pid, prodName, sku, barcode, preco, catId, subId, fotoUrl]);

    run(`INSERT INTO produto_imagens(id, produto_id, arquivo_path, mime_type, tamanho_bytes, principal, ordem)
         VALUES(?, ?, ?, 'image/jpeg', ?, 1, 0)`,
      [imgId, pid, relativePath, stat.size]);

    // Estoque inicial saudável
    const qtdEstoque = Math.floor(Math.random() * 800) + 200;
    run(`INSERT INTO estoque(produto_id, quantidade_disponivel, quantidade_reservada, estoque_minimo)
         VALUES(?, ?, 0, 50)`, [pid, qtdEstoque]);

    // Movimentação inicial de balanço / inventário
    run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
         VALUES(?, ?, 'INVENTARIO', ?, 0, ?, ?, 'Implantação inicial de saldo de estoque')`,
      [id(), pid, qtdEstoque, qtdEstoque, adminId]);

    produtosCriados.push({ id: pid, nome: prodName, preco, catName, subName, catId, subId });
  });

  console.log(`   ✓ ${produtosCriados.length} produtos cadastrados com foto, categoria, subcategoria e estoque.`);

  console.log('6. Cadastrando Tabelas de Preço (Atacado Ouro, Bares & Noturnos, Mercados)...');
  const tabelasPreco = [
    { id: 'tab-atacado-ouro', nome: 'Tabela Atacado Ouro - Distribuidores & Grandes Volumes (15% OFF)', desconto: 0.15 },
    { id: 'tab-bares-noturnos', nome: 'Tabela Bares, Adega & Casas Noturnas (10% OFF)', desconto: 0.10 },
    { id: 'tab-conveniencias', nome: 'Tabela Mercados & Padarias da Região (8% OFF)', desconto: 0.08 }
  ];

  tabelasPreco.forEach(tab => {
    run("INSERT INTO tabelas_preco(id, nome, ativo) VALUES(?, ?, 1)", [tab.id, tab.nome]);
    // Cadastra desconto de tabela em 40 produtos estratégicos
    produtosCriados.slice(0, 45).forEach(prod => {
      const precoEspecial = Number((prod.preco * (1 - tab.desconto)).toFixed(2));
      run(`INSERT INTO tabela_preco_itens(id, tabela_id, produto_id, preco, quantidade_minima)
           VALUES(?, ?, ?, ?, 1)`,
        [id(), tab.id, prod.id, precoEspecial]);
    });
  });
  console.log(`   ✓ 3 Tabelas de Preço criadas com itens promocionais customizados.`);

  console.log('7. Cadastrando Fornecedores Homologados (SRM)...');
  const fornecedoresDados = [
    {
      id: 'forn-ambev',
      nome: 'Ambev Distribuição Brasil S.A.',
      razao_social: 'Ambev Distribuição Brasil S.A.',
      nome_fantasia: 'Ambev',
      cnpj_cpf: '07.526.557/0001-00',
      contato_nome: 'Marcos Vinicius (Supervisor Regional)',
      telefone_whatsapp: '(33) 3271-8800',
      email: 'pedidos.gv@ambev.com.br',
      endereco: 'Rodovia BR-116, Km 410',
      cidade: 'Governador Valadares',
      estado: 'MG',
      cep: '35040-000',
      lead_time: 3,
      condicoes: 'Boleto 28 dias',
      palavrasChave: ['heineken', 'beats', 'h2oh']
    },
    {
      id: 'forn-femsa',
      nome: 'Coca-Cola FEMSA Brasil',
      razao_social: 'Spal Indústria Brasileira de Bebidas S/A',
      nome_fantasia: 'Coca-Cola FEMSA',
      cnpj_cpf: '45.997.418/0001-53',
      contato_nome: 'Carla Silveira',
      telefone_whatsapp: '(33) 3212-3000',
      email: 'distribuicao.valadares@kof.com.mx',
      endereco: 'Av. Minas Gerais, 2800',
      cidade: 'Governador Valadares',
      estado: 'MG',
      cep: '35010-000',
      lead_time: 2,
      condicoes: 'Boleto 21 dias',
      palavrasChave: ['coca-cola', 'fanta', 'sprite', 'del valle', 'monster']
    },
    {
      id: 'forn-diageo',
      nome: 'Diageo Brasil Bebidas Ltda',
      razao_social: 'Diageo Brasil Bebidas e Destilados Ltda',
      nome_fantasia: 'Diageo',
      cnpj_cpf: '00.916.495/0001-52',
      contato_nome: 'Roberto Antunes',
      telefone_whatsapp: '(31) 3348-7000',
      email: 'contato.comercial@diageo.com',
      endereco: 'Av. Barbacena, 1200',
      cidade: 'Belo Horizonte',
      estado: 'MG',
      cep: '30190-131',
      lead_time: 5,
      condicoes: 'Boleto 30 dias',
      palavrasChave: ['johnnie walker', 'white horse', 'smirnoff', 'cuervo']
    },
    {
      id: 'forn-pernod',
      nome: 'Pernod Ricard Brasil Ltda',
      razao_social: 'Pernod Ricard Brasil Indústria e Comércio Ltda',
      nome_fantasia: 'Pernod Ricard',
      cnpj_cpf: '33.075.467/0001-90',
      contato_nome: 'Juliana Paes',
      telefone_whatsapp: '(11) 3573-8000',
      email: 'vendas.distribuidor@pernod-ricard.com',
      endereco: 'Av. das Nações Unidas, 11541',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '04578-000',
      lead_time: 4,
      condicoes: 'Boleto 30/60 dias',
      palavrasChave: ['chivas', 'passport', 'absolut', 'orloff']
    },
    {
      id: 'forn-wilson',
      nome: 'Wilson Bebidas & Energéticos (Hits Power / Red Hot)',
      razao_social: 'Wilson Bebidas e Energéticos do Brasil S.A.',
      nome_fantasia: 'Wilson Drinks',
      cnpj_cpf: '14.238.991/0001-77',
      contato_nome: 'Thiago Mendes',
      telefone_whatsapp: '(31) 3779-1500',
      email: 'sac@hitspower.com.br',
      endereco: 'Distrito Industrial, Galpão 4',
      cidade: 'Sete Lagoas',
      estado: 'MG',
      cep: '35700-000',
      lead_time: 3,
      condicoes: 'Boleto 14/28 dias',
      palavrasChave: ['hitspower', 'hits power', 'red hot']
    },
    {
      id: 'forn-santa-helena',
      nome: 'Santa Helena Alimentos S.A.',
      razao_social: 'Santa Helena Indústria de Alimentos S.A.',
      nome_fantasia: 'Santa Helena Alimentos',
      cnpj_cpf: '55.978.857/0001-49',
      contato_nome: 'Eduardo Ramos',
      telefone_whatsapp: '(16) 3934-1000',
      email: 'pedidos@santahelena.com',
      endereco: 'Rua das Indústrias, 500',
      cidade: 'Ribeirão Preto',
      estado: 'SP',
      cep: '14000-000',
      lead_time: 4,
      condicoes: 'Boleto 21 dias',
      palavrasChave: ['amendoim', 'batata', 'molho']
    },
    {
      id: 'forn-garoto',
      nome: 'Garoto & Mondelez Distribuição de Confeitaria',
      razao_social: 'Distribuidora Nacional de Confeitaria e Chocolates Ltda',
      nome_fantasia: 'Garoto & Mondelez',
      cnpj_cpf: '28.145.221/0001-11',
      contato_nome: 'Luciana Brandão',
      telefone_whatsapp: '(27) 3320-1000',
      email: 'vendas@garotoatacadista.com.br',
      endereco: 'Praça Meyerfreund, 1',
      cidade: 'Vila Velha',
      estado: 'ES',
      cep: '29122-900',
      lead_time: 4,
      condicoes: 'Boleto 28 dias',
      palavrasChave: ['bombom', 'kit kat', 'trident', 'bubbaloo']
    },
    {
      id: 'forn-kromasa',
      nome: 'Kromasa Plásticos e Embalagens Ltda',
      razao_social: 'Kromasa Plásticos e Utilidades Descartáveis Ltda',
      nome_fantasia: 'Kromasa Embalagens',
      cnpj_cpf: '19.882.341/0001-88',
      contato_nome: 'Geraldo Magela',
      telefone_whatsapp: '(33) 3277-4400',
      email: 'sac@kromasa.com.br',
      endereco: 'Rua Quintino Bocaiúva, 800',
      cidade: 'Governador Valadares',
      estado: 'MG',
      cep: '35010-230',
      lead_time: 2,
      condicoes: 'Boleto 14 dias',
      palavrasChave: ['copo', 'saco', 'carvão', 'tek bond']
    }
  ];

  fornecedoresDados.forEach(f => {
    run(`INSERT INTO fornecedores(id, nome, razao_social, nome_fantasia, cnpj_cpf, contato_nome, telefone_whatsapp, email, endereco, cidade, estado, cep, lead_time_padrao_dias, condicoes_pagamento, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [f.id, f.nome, f.razao_social, f.nome_fantasia, f.cnpj_cpf, f.contato_nome, f.telefone_whatsapp, f.email, f.endereco, f.cidade, f.estado, f.cep, f.lead_time, f.condicoes]);

    // Vincula produtos ao fornecedor correspondente
    produtosCriados.forEach(prod => {
      const match = f.palavrasChave.some(kw => prod.nome.toLowerCase().includes(kw));
      if (match) {
        const custo = Number((prod.preco * 0.55).toFixed(2));
        run(`INSERT INTO fornecedor_produtos(id, fornecedor_id, produto_id, codigo_referencia_fornecedor, custo_aquisicao, lead_time_dias, quantidade_minima_compra, preferencial, ativo)
             VALUES(?, ?, ?, ?, ?, ?, 5, 1, 1)`,
          [id(), f.id, prod.id, `REF-${f.id.slice(5, 8).toUpperCase()}-${prod.id.slice(0, 4)}`, custo, f.lead_time]);
      }
    });
  });
  console.log(`   ✓ 8 Fornecedores homologados e produtos associados com custos de aquisição.`);

  console.log('8. Cadastrando Compras (Inbound) e Registros de Recebimento de Mercadorias com NF...');
  const comprasStatusList = [
    { num: 'PC-2026-000001', forn: 'forn-femsa', status: 'CONCLUIDO', nf: 'NF-104921', conclOffset: 12 },
    { num: 'PC-2026-000002', forn: 'forn-ambev', status: 'CONCLUIDO', nf: 'NF-203819', conclOffset: 9 },
    { num: 'PC-2026-000003', forn: 'forn-diageo', status: 'CONCLUIDO', nf: 'NF-304192', conclOffset: 6 },
    { num: 'PC-2026-000004', forn: 'forn-wilson', status: 'CONCLUIDO', nf: 'NF-401928', conclOffset: 4 },
    { num: 'PC-2026-000005', forn: 'forn-santa-helena', status: 'CONCLUIDO', nf: 'NF-509123', conclOffset: 2 },
    { num: 'PC-2026-000006', forn: 'forn-garoto', status: 'CONCLUIDO', nf: 'NF-608127', conclOffset: 1 },
    { num: 'PC-2026-000007', forn: 'forn-kromasa', status: 'RECEBIDO_PARCIAL', nf: 'NF-701923', conclOffset: null },
    { num: 'PC-2026-000008', forn: 'forn-pernod', status: 'RECEBIDO_PARCIAL', nf: 'NF-801239', conclOffset: null },
    { num: 'PC-2026-000009', forn: 'forn-femsa', status: 'A_CAMINHO', nf: null, conclOffset: null },
    { num: 'PC-2026-000010', forn: 'forn-wilson', status: 'A_CAMINHO', nf: null, conclOffset: null },
    { num: 'PC-2026-000011', forn: 'forn-diageo', status: 'CONFIRMADO', nf: null, conclOffset: null },
    { num: 'PC-2026-000012', forn: 'forn-ambev', status: 'CONFIRMADO', nf: null, conclOffset: null }
  ];

  comprasStatusList.forEach(c => {
    const cid = id();
    const forn = fornecedoresDados.find(x => x.id === c.forn);
    const dataEmissao = new Date(Date.now() - 14 * 86400000).toISOString();
    const previsao = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const dataConclusao = c.conclOffset != null ? new Date(Date.now() - c.conclOffset * 86400000).toISOString() : null;

    // Acha produtos desse fornecedor
    const fornProds = all('SELECT * FROM fornecedor_produtos WHERE fornecedor_id=?', [c.forn]);
    const itensEscolhidos = fornProds.slice(0, 4);

    let totalCompra = 0;
    itensEscolhidos.forEach(fp => {
      const qPedida = 100;
      const sub = Number((fp.custo_aquisicao * qPedida).toFixed(2));
      totalCompra += sub;
    });

    run(`INSERT INTO compras(id, numero, fornecedor_id, comprador_id, status, data_emissao, previsao_entrega, data_conclusao, valor_total, numero_nota_fiscal, observacoes)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cid, c.num, c.forn, adminId, c.status, dataEmissao, previsao, dataConclusao, totalCompra, c.nf, `Pedido de reposição de estoque - ${forn.nome}`]);

    itensEscolhidos.forEach(fp => {
      const qPedida = 100;
      let qRecebida = 0;
      if (c.status === 'CONCLUIDO') qRecebida = qPedida;
      else if (c.status === 'RECEBIDO_PARCIAL') qRecebida = 50;

      const sub = Number((fp.custo_aquisicao * qPedida).toFixed(2));
      run(`INSERT INTO compra_itens(id, compra_id, produto_id, quantidade_pedida, quantidade_recebida, custo_unitario, subtotal)
           VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [id(), cid, fp.produto_id, qPedida, qRecebida, fp.custo_aquisicao, sub]);

      // Se houve recebimento, gera movimentação de entrada de compra
      if (qRecebida > 0) {
        const st = one('SELECT quantidade_disponivel FROM estoque WHERE produto_id=?', [fp.produto_id]);
        const saldoAnterior = st?.quantidade_disponivel || 0;
        const saldoPosterior = saldoAnterior + qRecebida;

        run('UPDATE estoque SET quantidade_disponivel=? WHERE produto_id=?', [saldoPosterior, fp.produto_id]);
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'ENTRADA_COMPRA', ?, ?, ?, ?, ?)`,
          [id(), fp.produto_id, qRecebida, saldoAnterior, saldoPosterior, adminId, `Entrada Compra ${c.num} - Forn: ${forn.nome_fantasia} - NF: ${c.nf}`]);
      }
    });
  });
  console.log(`   ✓ 12 Pedidos de compra cadastrados com histórico de recebimento de mercadorias.`);

  console.log('9. Cadastrando Clientes com Bairros, Coordenadas e Tabelas de Preço Aplicadas...');
  const clientesComerciais = [];
  const tiposComercio = ['Bar', 'Mercearia', 'Restaurante', 'Lanchonete', 'Empório', 'Adega', 'Supermercado', 'Conveniência'];

  // 120 clientes comerciais distribuídos por bairros de GV
  for (let c = 1; c <= 120; c++) {
    const cid = id();
    const bInfo = bairrosGV[c % bairrosGV.length];
    const tipo = tiposComercio[c % tiposComercio.length];
    const vend = uVendedores[c % uVendedores.length];

    // Distribui tabelas de preço entre clientes
    let tabId = null;
    if (c % 4 === 1) tabId = 'tab-atacado-ouro';
    else if (c % 4 === 2) tabId = 'tab-bares-noturnos';
    else if (c % 4 === 3) tabId = 'tab-conveniencias';

    const latVariada = Number((bInfo.lat + (Math.random() - 0.5) * 0.008).toFixed(6));
    const lngVariada = Number((bInfo.lng + (Math.random() - 0.5) * 0.008).toFixed(6));
    const doc = `22.${String(c).padStart(3, '0')}.456/0001-${String((c % 90) + 10)}`;
    const tel = `(33) 9${Math.floor(Math.random() * 8999 + 1000)}-${Math.floor(Math.random() * 8999 + 1000)}`;

    run(`INSERT INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, telefone, email, endereco, bairro, cidade, estado, latitude, longitude, tabela_preco_id, vendedor_id, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Governador Valadares', 'MG', ?, ?, ?, ?, 1)`,
      [
        cid,
        `${tipo} ${bInfo.nome} Ltda ${c}`,
        `${tipo} do ${bInfo.nome} #${c}`,
        doc,
        tel,
        `contato.cliente${c}@gvnegocios.com.br`,
        `Rua das Palmeiras, ${c * 15}`,
        bInfo.nome,
        latVariada,
        lngVariada,
        tabId,
        vend.id
      ]);
    clientesComerciais.push({ id: cid, nome: `${tipo} do ${bInfo.nome} #${c}`, bairro: bInfo.nome, vendedor_id: vend.id, lat: latVariada, lng: lngVariada, tabela_preco_id: tabId });
  }

  // 50 clientes da Loja Online vinculados aos usuários web
  const clientesWeb = [];
  uWeb.forEach((wUser, idx) => {
    const cid = id();
    const bInfo = bairrosGV[idx % bairrosGV.length];
    const latVariada = Number((bInfo.lat + (Math.random() - 0.5) * 0.008).toFixed(6));
    const lngVariada = Number((bInfo.lng + (Math.random() - 0.5) * 0.008).toFixed(6));
    const cpf = `111.${String(idx + 1).padStart(3, '0')}.789-${String((idx % 90) + 10)}`;
    const tel = `(33) 98888-${String(idx + 1000).slice(-4)}`;

    // Alguns clientes web também têm tabela atacado ou conveniência
    const tabId = (idx % 3 === 0) ? 'tab-conveniencias' : ((idx % 5 === 0) ? 'tab-atacado-ouro' : null);

    run(`INSERT INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, telefone, email, endereco, bairro, cidade, estado, latitude, longitude, tabela_preco_id, vendedor_id, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Governador Valadares', 'MG', ?, ?, ?, NULL, 1)`,
      [
        cid,
        `Cliente Online ${wUser.nome}`,
        wUser.nome,
        cpf,
        tel,
        `web${idx + 1}@gv.local`,
        `Av. Brasil, ${100 + idx * 10}`,
        bInfo.nome,
        latVariada,
        lngVariada,
        tabId
      ]);

    run(`INSERT INTO usuario_clientes(usuario_id, cliente_id) VALUES(?, ?)`, [wUser.id, cid]);
    clientesWeb.push({ id: cid, nome: wUser.nome, usuario_id: wUser.id, bairro: bInfo.nome, lat: latVariada, lng: lngVariada, tabela_preco_id: tabId });
  });

  console.log('10. Gerando Linha do Tempo e Interações de CRM com Resultados...');
  const crmInteracoesModelos = [
    { tipo: 'VISITA', desc: 'Visita comercial presencial realizada. Apresentado novo catálogo de destilados e energéticos. Resultado: Cliente aprovou proposta e incluiu fardos de Red Hot no pedido regular.' },
    { tipo: 'WHATSAPP', desc: 'Contato via WhatsApp para reposição semanal. Resultado: Cliente confirmou estoque baixo de cervejas e solicitou emissão de pedido de 20 fardos.' },
    { tipo: 'LIGACAO', desc: 'Ligação de relacionamento e pós-venda. Resultado: Cliente elogiou pontualidade da entrega da rota matutina. Programada visita quinzenal.' },
    { tipo: 'VISITA', desc: 'Apresentação da Tabela Atacado Ouro com descontos escalonados. Resultado: Cliente migrou compras de bebidas concorrentes para a nossa distribuidora.' },
    { tipo: 'WHATSAPP', desc: 'Envio da tabela de preços atualizada em PDF. Resultado: Cliente solicitou cotação especial para evento no final de semana.' },
    { tipo: 'COBRANCA', desc: 'Contato financeiro referente ao boleto do pedido anterior. Resultado: Cliente enviou comprovante de quitação bancária via WhatsApp.' },
    { tipo: 'OBSERVACAO', desc: 'Anotação de campo: Estabelecimento ampliou espaço de bar e aumentará volume de destilados nos finais de semana.' }
  ];

  clientesComerciais.slice(0, 40).forEach((cli, idx) => {
    const qtdInt = Math.floor(Math.random() * 3) + 1;
    for (let k = 0; k < qtdInt; k++) {
      const modelo = crmInteracoesModelos[(idx + k) % crmInteracoesModelos.length];
      const diasAtras = (k * 4) + Math.floor(Math.random() * 3);
      const dataIso = new Date(Date.now() - diasAtras * 86400000).toISOString();
      run(`INSERT INTO cliente_interacoes(id, cliente_id, usuario_id, tipo, descricao, created_at)
           VALUES(?, ?, ?, ?, ?, ?)`,
        [id(), cli.id, cli.vendedor_id, modelo.tipo, modelo.desc, dataIso]);
    }
  });
  console.log(`   ✓ Interações de CRM geradas com tipos, operadores e resultados comerciais.`);

  console.log('11. Gerando Movimentações Operacionais de Estoque (Ajustes, Entradas, Saídas, Avarias)...');
  // Cria saídas, perdas e ajustes de inventário para compor o histórico completo
  produtosCriados.slice(0, 30).forEach((p, idx) => {
    const st = one('SELECT quantidade_disponivel FROM estoque WHERE produto_id=?', [p.id]);
    const saldo = st?.quantidade_disponivel || 500;

    if (idx % 3 === 0) {
      // Ajuste de contagem
      run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
           VALUES(?, ?, 'AJUSTE', +12, ?, ?, ?, 'Ajuste após contagem física periódica de prateleira')`,
        [id(), p.id, saldo, saldo + 12, adminId]);
      run('UPDATE estoque SET quantidade_disponivel=? WHERE produto_id=?', [saldo + 12, p.id]);
    } else if (idx % 3 === 1) {
      // Saída por avaria / dano no transporte
      run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
           VALUES(?, ?, 'SAIDA', -2, ?, ?, ?, 'Avaria identificada durante descarregamento na doca')`,
        [id(), p.id, saldo, saldo - 2, adminId]);
      run('UPDATE estoque SET quantidade_disponivel=? WHERE produto_id=?', [saldo - 2, p.id]);
    } else {
      // Entrada manual de bonificação do fabricante
      run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
           VALUES(?, ?, 'ENTRADA', +24, ?, ?, ?, 'Bonificação recebida do fabricante para campanha promocional')`,
        [id(), p.id, saldo, saldo + 24, adminId]);
      run('UPDATE estoque SET quantidade_disponivel=? WHERE produto_id=?', [saldo + 24, p.id]);
    }
  });

  console.log('12. Gerando Pedidos com Aplicação de Tabela de Preço e Origens Diversas (WEB, VENDEDOR, BALCAO)...');

  function criarPedidoDemonstracao(origem, operadorId, cliente, status, dataOffsetDias = 0) {
    const pid = id();
    const d = new Date(Date.now() - dataOffsetDias * 86400000);
    const dataIso = d.toISOString();
    const num = `XV-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`;

    run(`INSERT INTO pedidos(id, numero, cliente_id, operador_id, origem, status, total, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [pid, num, cliente.id, operadorId, origem, status, dataIso, dataIso]);

    let total = 0;
    const qtdItens = Math.floor(Math.random() * 4) + 1;

    for (let k = 0; k < qtdItens; k++) {
      const prod = produtosCriados[Math.floor(Math.random() * produtosCriados.length)];
      const qtd = Math.floor(Math.random() * 6) + 1;

      // Verifica se o cliente tem tabela de preço aplicada para este produto
      let precoAplicado = prod.preco;
      if (cliente.tabela_preco_id) {
        const itemTab = one('SELECT preco FROM tabela_preco_itens WHERE tabela_id=? AND produto_id=?', [cliente.tabela_preco_id, prod.id]);
        if (itemTab) {
          precoAplicado = Number(itemTab.preco);
        }
      }

      const subtotal = Number((precoAplicado * qtd).toFixed(2));
      total += subtotal;

      run(`INSERT INTO pedido_itens(id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, subtotal)
           VALUES(?, ?, ?, ?, ?, ?)`,
        [id(), pid, prod.id, qtd, precoAplicado, subtotal]);

      const st = one('SELECT quantidade_disponivel, quantidade_reservada FROM estoque WHERE produto_id=?', [prod.id]);
      const disp = st?.quantidade_disponivel || 0;

      if (status === 'CONCLUIDO') {
        run(`UPDATE estoque SET quantidade_disponivel = MAX(0, quantidade_disponivel - ?) WHERE produto_id = ?`, [qtd, prod.id]);
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'SAIDA_VENDA', ?, ?, ?, ?, ?)`,
          [id(), prod.id, -qtd, disp, Math.max(0, disp - qtd), operadorId || adminId, `Saída do pedido entregue ${num}`]);
      } else {
        run(`UPDATE estoque SET quantidade_reservada = quantidade_reservada + ? WHERE produto_id = ?`, [qtd, prod.id]);
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'RESERVA', ?, ?, ?, ?, ?)`,
          [id(), prod.id, -qtd, disp, disp, operadorId || adminId, `Reserva para pedido ${num} (${status})`]);
      }
    }

    run(`UPDATE pedidos SET total = ? WHERE id = ?`, [Number(total.toFixed(2)), pid]);
    return { id: pid, total, status };
  }

  // A) 140 Pedidos CONCLUÍDOS (Histórico financeiro para os relatórios e dashboard)
  for (let i = 0; i < 140; i++) {
    const diasAtras = Math.floor(Math.random() * 28);
    if (i % 3 === 0) {
      // Venda Balcão PDV
      const cx = uCaixas[i % uCaixas.length];
      criarPedidoDemonstracao('BALCAO', cx.id, { id: 'CLIENTE-BALCAO', tabela_preco_id: null }, 'CONCLUIDO', diasAtras);
    } else if (i % 3 === 1) {
      // Venda Vendedor Externo (com tabelas de preço aplicadas)
      const cli = clientesComerciais[i % clientesComerciais.length];
      criarPedidoDemonstracao('VENDEDOR', cli.vendedor_id, cli, 'CONCLUIDO', diasAtras);
    } else {
      // Venda Loja Online (Web)
      const cWeb = clientesWeb[i % clientesWeb.length];
      criarPedidoDemonstracao('WEB', null, cWeb, 'CONCLUIDO', diasAtras);
    }
  }

  // B) 50 Pedidos em SEPARAÇÃO (Prontos para serem roteirizados no painel de Logística)
  for (let i = 0; i < 50; i++) {
    if (i % 2 === 0) {
      const cli = clientesComerciais[i % clientesComerciais.length];
      criarPedidoDemonstracao('VENDEDOR', cli.vendedor_id, cli, 'SEPARACAO', 0);
    } else {
      const cWeb = clientesWeb[i % clientesWeb.length];
      criarPedidoDemonstracao('WEB', null, cWeb, 'SEPARACAO', 0);
    }
  }

  // C) 20 Pedidos em ROTA (Atribuídos a 2 Motoristas)
  const rotaOrders1 = [];
  const rotaOrders2 = [];
  for (let i = 0; i < 10; i++) {
    const cli1 = clientesComerciais[i % clientesComerciais.length];
    const p1 = criarPedidoDemonstracao('VENDEDOR', cli1.vendedor_id, cli1, 'ROTA', 0);
    rotaOrders1.push(p1.id);

    const cli2 = clientesComerciais[(i + 10) % clientesComerciais.length];
    const p2 = criarPedidoDemonstracao('VENDEDOR', cli2.vendedor_id, cli2, 'ROTA', 0);
    rotaOrders2.push(p2.id);
  }

  // D) 15 Pedidos PENDENTES
  for (let i = 0; i < 15; i++) {
    if (i % 2 === 0) {
      const cli = clientesComerciais[i % clientesComerciais.length];
      criarPedidoDemonstracao('VENDEDOR', cli.vendedor_id, cli, 'PENDENTE', 0);
    } else {
      const cWeb = clientesWeb[i % clientesWeb.length];
      criarPedidoDemonstracao('WEB', null, cWeb, 'PENDENTE', 0);
    }
  }

  // E) 5 Pedidos CANCELADOS (demonstrando histórico de cancelamentos e estorno de estoque CANCELAMENTO_PEDIDO)
  for (let i = 0; i < 5; i++) {
    const cli = clientesComerciais[i % clientesComerciais.length];
    const pid = id();
    const num = `XV-2026-${String(Math.floor(Math.random() * 900000) + 100000)}`;
    const d = new Date(Date.now() - 3 * 86400000).toISOString();
    run(`INSERT INTO pedidos(id, numero, cliente_id, operador_id, origem, status, total, cancelled_at, cancelled_by, cancel_reason, created_at, updated_at)
         VALUES(?, ?, ?, ?, 'VENDEDOR', 'PENDENTE', 0, ?, ?, 'Cancelado a pedido do cliente antes do despacho', ?, ?)`,
      [pid, num, cli.id, cli.vendedor_id, d, adminId, d, d]);
    const prod = produtosCriados[i];
    run(`INSERT INTO pedido_itens(id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, subtotal)
         VALUES(?, ?, ?, 10, ?, ?)`,
      [id(), pid, prod.id, prod.preco, prod.preco * 10]);
    run(`UPDATE pedidos SET total=? WHERE id=?`, [prod.preco * 10, pid]);
    run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
         VALUES(?, ?, 'CANCELAMENTO_PEDIDO', 10, 500, 510, ?, ?)`,
      [id(), prod.id, adminId, `Estorno da reserva do pedido cancelado ${num}`]);
  }

  console.log('13. Gerando Rotas Ativas Otimizadas para os Motoristas...');
  const hoje = new Date().toISOString().slice(0, 10);
  const rotaId1 = id();
  const rotaId2 = id();

  run(`INSERT INTO rotas_logistica(id, motorista_id, data, status, sequencia_json, distance_km, estimated_minutes)
       VALUES(?, ?, ?, 'PLANEJADA', ?, 12.8, 35)`,
    [rotaId1, uMotoristas[0].id, hoje, JSON.stringify(rotaOrders1)]);

  rotaOrders1.forEach((pid, idx) => {
    run(`INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)`, [rotaId1, pid, idx + 1]);
  });

  run(`INSERT INTO rotas_logistica(id, motorista_id, data, status, sequencia_json, distance_km, estimated_minutes)
       VALUES(?, ?, ?, 'PLANEJADA', ?, 15.4, 42)`,
    [rotaId2, uMotoristas[1].id, hoje, JSON.stringify(rotaOrders2)]);

  rotaOrders2.forEach((pid, idx) => {
    run(`INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)`, [rotaId2, pid, idx + 1]);
  });

  console.log('\n=== Carga de Demonstração Concluída com Sucesso! ===');
  console.log(`Categorias: ${catMap.size} categorias e ${subMap.size} subcategorias distribuídas.`);
  console.log(`Produtos: ${produtosCriados.length} itens cadastrados com foto, categoria e subcategoria.`);
  console.log(`Tabelas de Preço: 3 tabelas ativas aplicadas a clientes B2B.`);
  console.log(`Fornecedores: 8 fornecedores homologados com catálogo de produtos vinculado.`);
  console.log(`Compras (Inbound): 12 compras registradas com notas fiscais e recebimentos concluídos.`);
  console.log(`CRM: ~80 interações registradas com múltiplos canais e resultados comerciais.`);
  console.log(`Movimentações de Estoque: Histórico com Entradas de Compra, Inventário, Ajustes, Saídas e Reservas.`);
  console.log(`Usuários: 1 Admin, 10 Vendedores, 4 Caixas, 6 Motoristas, 50 Clientes Web.`);
  console.log(`Clientes: 120 Comerciais + 50 Clientes da Loja Online.`);
  console.log(`Pedidos: ~140 Concluídos, 50 em Separação, 20 em Rota, 15 Pendentes.`);
});
