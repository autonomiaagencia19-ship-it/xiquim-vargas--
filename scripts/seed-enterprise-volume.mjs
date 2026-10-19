import fs from 'node:fs';
import path from 'node:path';
import { run, tx, id, all, one, db, STORAGE, ROOT } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

console.log('=== Iniciando Carga Massiva Corporativa - Xiquim Vargas ERP ===\n');

const defaultPassword = hashPassword('ChangeMe123!');

// Bairros e coordenadas de Governador Valadares (MG)
const bairrosGV = [
  { nome: 'Centro', lat: -18.8542, lng: -41.9515, dia: 1, rota: 'Rota 01 - Centro e Ilha' },
  { nome: 'Ilha dos Araújos', lat: -18.8590, lng: -41.9420, dia: 1, rota: 'Rota 01 - Centro e Ilha' },
  { nome: 'São Paulo', lat: -18.8500, lng: -41.9380, dia: 1, rota: 'Rota 01 - Centro e Ilha' },
  { nome: 'Esplanada', lat: -18.8480, lng: -41.9720, dia: 1, rota: 'Rota 01 - Centro e Ilha' },
  { nome: 'Vila Mariana', lat: -18.8560, lng: -41.9850, dia: 1, rota: 'Rota 01 - Centro e Ilha' },

  { nome: 'Vila Bretas', lat: -18.8450, lng: -41.9600, dia: 2, rota: 'Rota 02 - Zona Sul & Bretas' },
  { nome: 'Santa Rita', lat: -18.8680, lng: -41.9580, dia: 2, rota: 'Rota 02 - Zona Sul & Bretas' },
  { nome: 'Carapina', lat: -18.8730, lng: -41.9620, dia: 2, rota: 'Rota 02 - Zona Sul & Bretas' },
  { nome: 'São Pedro', lat: -18.8650, lng: -41.9650, dia: 2, rota: 'Rota 02 - Zona Sul & Bretas' },
  { nome: 'Santos Dumont', lat: -18.8700, lng: -41.9500, dia: 2, rota: 'Rota 02 - Zona Sul & Bretas' },

  { nome: 'Lourdes', lat: -18.8620, lng: -41.9350, dia: 3, rota: 'Rota 03 - Zona Leste & Morada' },
  { nome: 'Grã-Duquesa', lat: -18.8710, lng: -41.9300, dia: 3, rota: 'Rota 03 - Zona Leste & Morada' },
  { nome: 'Morada do Acampamento', lat: -18.8750, lng: -41.9250, dia: 3, rota: 'Rota 03 - Zona Leste & Morada' },
  { nome: 'Universitário', lat: -18.8780, lng: -41.9200, dia: 3, rota: 'Rota 03 - Zona Leste & Morada' },
  { nome: 'Lagoa Santa', lat: -18.8600, lng: -41.9280, dia: 3, rota: 'Rota 03 - Zona Leste & Morada' },

  { nome: 'Altinópolis', lat: -18.8320, lng: -41.9700, dia: 4, rota: 'Rota 04 - Zona Norte & Castanheiras' },
  { nome: 'Castanheiras', lat: -18.8250, lng: -41.9650, dia: 4, rota: 'Rota 04 - Zona Norte & Castanheiras' },
  { nome: 'Esperança', lat: -18.8380, lng: -41.9620, dia: 4, rota: 'Rota 04 - Zona Norte & Castanheiras' },
  { nome: 'São Cristóvão', lat: -18.8300, lng: -41.9550, dia: 4, rota: 'Rota 04 - Zona Norte & Castanheiras' },
  { nome: 'Jardim Pérola', lat: -18.8400, lng: -41.9500, dia: 4, rota: 'Rota 04 - Zona Norte & Castanheiras' },

  { nome: 'Santa Paula', lat: -18.8520, lng: -41.9800, dia: 5, rota: 'Rota 05 - Zona Oeste & Ibituruna' },
  { nome: 'Vila Isa', lat: -18.8800, lng: -41.9600, dia: 5, rota: 'Rota 05 - Zona Oeste & Ibituruna' },
  { nome: 'Asteca', lat: -18.8850, lng: -41.9650, dia: 5, rota: 'Rota 05 - Zona Oeste & Ibituruna' },
  { nome: 'São Raimundo', lat: -18.8900, lng: -41.9700, dia: 5, rota: 'Rota 05 - Zona Oeste & Ibituruna' },
  { nome: 'Elvamar', lat: -18.8950, lng: -41.9750, dia: 5, rota: 'Rota 05 - Zona Oeste & Ibituruna' },

  { nome: 'Sir', lat: -18.8180, lng: -41.9850, dia: 6, rota: 'Rota 06 - Expansão & Distritos' },
  { nome: 'Turmalina', lat: -18.8150, lng: -41.9750, dia: 6, rota: 'Rota 06 - Expansão & Distritos' },
  { nome: 'Palmeiras', lat: -18.8200, lng: -41.9700, dia: 6, rota: 'Rota 06 - Expansão & Distritos' },
  { nome: 'JK', lat: -18.8100, lng: -41.9650, dia: 6, rota: 'Rota 06 - Expansão & Distritos' },
  { nome: 'Cidade Nova', lat: -18.8050, lng: -41.9600, dia: 6, rota: 'Rota 06 - Expansão & Distritos' }
];

const cronogramaSemanalConfig = [
  { dia: 'Segunda', rota: 'Rota 01 - Centro e Ilha', bairros: ['Centro', 'Ilha dos Araújos', 'São Paulo', 'Esplanada', 'Vila Mariana'], motorista: 'Carlos Eduardo (Motorista 01)' },
  { dia: 'Terça', rota: 'Rota 02 - Zona Sul & Bretas', bairros: ['Vila Bretas', 'Santa Rita', 'Carapina', 'São Pedro', 'Santos Dumont'], motorista: 'Marcos Vinicius (Motorista 03)' },
  { dia: 'Quarta', rota: 'Rota 03 - Zona Leste & Morada', bairros: ['Lourdes', 'Grã-Duquesa', 'Morada do Acampamento', 'Universitário', 'Lagoa Santa'], motorista: 'Rafael Santos (Motorista 05)' },
  { dia: 'Quinta', rota: 'Rota 04 - Zona Norte & Castanheiras', bairros: ['Altinópolis', 'Castanheiras', 'Esperança', 'São Cristóvão', 'Jardim Pérola'], motorista: 'Lucas Henrique (Motorista 07)' },
  { dia: 'Sexta', rota: 'Rota 05 - Zona Oeste & Ibituruna', bairros: ['Santa Paula', 'Vila Isa', 'Asteca', 'São Raimundo', 'Elvamar'], motorista: 'Felipe Augusto (Motorista 09)' },
  { dia: 'Sábado', rota: 'Rota 06 - Expansão & Distritos', bairros: ['Sir', 'Turmalina', 'Palmeiras', 'JK', 'Cidade Nova'], motorista: 'Bruno Almeida (Motorista 11)' }
];

db.exec('PRAGMA foreign_keys = OFF');
tx(() => {
  try {
  console.log('1. Verificando produtos reais já cadastrados...');
  const produtosReais = all('SELECT id, nome, sku, preco_base FROM produtos WHERE ativo=1');
  if (!produtosReais.length) {
    throw new Error('Nenhum produto cadastrado! Abortando para proteger dados.');
  }
  console.log(`   ✓ ${produtosReais.length} produtos reais ativos localizados no banco.`);

  // 1. Limpeza de tabelas transacionais (preservando categorias, subcategorias, produtos e fotos!)
  console.log('2. Limpando dados operacionais transitórios...');
  run('DELETE FROM audit_logs');
  run('DELETE FROM idempotency_keys');
  run('DELETE FROM comprovantes_entrega');
  run('DELETE FROM pedido_retornos');
  run('DELETE FROM rota_pedidos');
  run('DELETE FROM rotas_logistica');
  run('DELETE FROM pedido_itens');
  run('DELETE FROM pedidos');
  run('DELETE FROM cliente_interacoes');
  run('DELETE FROM usuario_clientes');
  run("DELETE FROM clientes WHERE id != 'CLIENTE-BALCAO'");
  run('DELETE FROM compra_itens');
  run('DELETE FROM compras');
  run('DELETE FROM fornecedor_produtos');
  run('DELETE FROM fornecedores');
  run('DELETE FROM rota_bairros');
  run('DELETE FROM vendedor_rotas');
  run('DELETE FROM rotas_config');
  run('DELETE FROM tabela_preco_itens');
  run("DELETE FROM tabelas_preco WHERE id NOT IN ('tab-padrao')");
  run("DELETE FROM usuarios WHERE role != 'admin' OR email LIKE '%@gv.local' OR email LIKE '%@xiquimvargas.com.br'");

  // 2. Administradores adicionais
  console.log('3. Criando 3 Administradores adicionais...');
  const adminsNovos = [
    { nome: 'Carlos Mendonça - Diretoria', email: 'admin.diretoria@xiquimvargas.com.br', tel: '(33) 98877-0101' },
    { nome: 'Juliana Costa - Operações & Logística', email: 'admin.operacoes@xiquimvargas.com.br', tel: '(33) 98877-0102' },
    { nome: 'Renato Silveira - Finanças & Controladoria', email: 'admin.financeiro@xiquimvargas.com.br', tel: '(33) 98877-0103' }
  ];
  const uAdmins = [];
  adminsNovos.forEach(adm => {
    let row = one('SELECT id FROM usuarios WHERE email=?', [adm.email]);
    if (!row) {
      const uid = id();
      run(`INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone, ativo) VALUES(?, ?, ?, ?, 'admin', ?, 1)`,
        [uid, adm.nome, adm.email, defaultPassword, adm.tel]);
      uAdmins.push({ id: uid, ...adm });
    } else {
      uAdmins.push({ id: row.id, ...adm });
    }
  });
  const mainAdminId = uAdmins[0]?.id || one("SELECT id FROM usuarios WHERE role='admin' LIMIT 1")?.id;
  console.log(`   ✓ 3 Administradores corporativos configurados.`);

  // 3. Dezenas de Vendedores, Motoristas e Caixas
  console.log('4. Criando Usuários Operacionais (25 Vendedores, 20 Motoristas, 15 Caixas PDV, 50 Usuários Web)...');
  const uVendedores = [];
  const nomesVendedores = [
    'Rodrigo Barbosa', 'Vanessa Martins', 'Gabriel Toledo', 'Camila Nogueira', 'Leonardo Pires',
    'Tatiane Freitas', 'Lucas Guimarães', 'Beatriz Alvarenga', 'Matheus Figueiredo', 'Larissa Duarte',
    'Thiago Neves', 'Priscila Rocha', 'Danilo Queiroz', 'Aline Vasconcelos', 'Fabio Meireles',
    'Patricia Antunes', 'Gustavo Bernardes', 'Sabrina Lemos', 'Marcelo Fontes', 'Amanda Teles',
    'Eduardo Campolina', 'Renata Valadares', 'Vinicius Drummond', 'Fernanda Castilho', 'Alexandre Gusmão'
  ];
  nomesVendedores.forEach((nome, i) => {
    const uid = id();
    const email = `vendedor${i + 1}@xiquimvargas.com.br`;
    const tel = `(33) 9${Math.floor(Math.random() * 8000 + 1000)}-${Math.floor(Math.random() * 8000 + 1000)}`;
    run(`INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone, ativo) VALUES(?, ?, ?, ?, 'seller', ?, 1)`,
      [uid, nome, email, defaultPassword, tel]);
    uVendedores.push({ id: uid, nome, email, tel });
  });

  const uMotoristas = [];
  const nomesMotoristas = [
    'Carlos Eduardo', 'Valdir Moreira', 'Marcos Vinicius', 'Jose Geraldo', 'Rafael Santos',
    'Wellington Silva', 'Lucas Henrique', 'Ademir Batista', 'Felipe Augusto', 'Claudio Roberto',
    'Bruno Almeida', 'Geraldo Magela', 'Anderson Souza', 'Marcio Rezende', 'Sebastiao Dias',
    'Cristiano Ramos', 'Helio Ferreira', 'Ronaldo Peixoto', 'Gilberto Maia', 'Leandro Chaves'
  ];
  nomesMotoristas.forEach((nome, i) => {
    const uid = id();
    const email = `motorista${i + 1}@xiquimvargas.com.br`;
    const tel = `(33) 9${Math.floor(Math.random() * 8000 + 1000)}-${Math.floor(Math.random() * 8000 + 1000)}`;
    run(`INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone, ativo) VALUES(?, ?, ?, ?, 'driver', ?, 1)`,
      [uid, `${nome} (Motorista ${String(i + 1).padStart(2, '0')})`, email, defaultPassword, tel]);
    uMotoristas.push({ id: uid, nome, email, tel });
  });

  const uCaixas = [];
  for (let i = 1; i <= 15; i++) {
    const uid = id();
    const email = `caixa${i}@xiquimvargas.com.br`;
    const tel = `(33) 3271-${String(1000 + i).slice(-4)}`;
    run(`INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone, ativo) VALUES(?, ?, ?, ?, 'cashier', ?, 1)`,
      [uid, `Operador Caixa PDV ${String(i).padStart(2, '0')}`, email, defaultPassword, tel]);
    uCaixas.push({ id: uid, nome: `Caixa ${i}`, email, tel });
  }

  const uWeb = [];
  for (let i = 1; i <= 50; i++) {
    const uid = id();
    const email = `cliente.web${i}@gmail.com`;
    const tel = `(33) 991${String(i).padStart(2, '0')}-${String(Math.floor(Math.random() * 8000 + 1000))}`;
    run(`INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone, ativo) VALUES(?, ?, ?, ?, 'web_client', ?, 1)`,
      [uid, `Cliente Digital ${i}`, email, defaultPassword, tel]);
    uWeb.push({ id: uid, nome: `Cliente Digital ${i}`, email, tel });
  }
  console.log(`   ✓ ${uVendedores.length} vendedores, ${uMotoristas.length} motoristas, ${uCaixas.length} caixas PDV e ${uWeb.length} usuários Web.`);

  // 4. Cronogramas de entrega e rotas cadastradas por dia da semana
  console.log('5. Configurando Rotas e Cronograma Semanal Completo (Segunda a Sábado)...');
  run(`INSERT OR REPLACE INTO configuracoes(chave, valor, updated_at) VALUES('delivery.routes_schedule', ?, CURRENT_TIMESTAMP)`,
    [JSON.stringify(cronogramaSemanalConfig)]);

  const rotasConfigCriadas = [];
  for (let dia = 1; dia <= 6; dia++) {
    const cfg = cronogramaSemanalConfig[dia - 1];
    const rotaId = id();
    run(`INSERT INTO rotas_config(id, nome, dia_semana, ativo) VALUES(?, ?, ?, 1)`,
      [rotaId, cfg.rota, dia]);
    rotasConfigCriadas.push({ id: rotaId, nome: cfg.rota, dia, bairros: cfg.bairros });

    cfg.bairros.forEach((b, idx) => {
      run(`INSERT INTO rota_bairros(id, rota_config_id, bairro, ordem) VALUES(?, ?, ?, ?)`,
        [id(), rotaId, b, idx + 1]);
    });

    // Vincula vendedor daquele dia/rota
    const vend = uVendedores[(dia - 1) % uVendedores.length];
    run(`INSERT OR REPLACE INTO vendedor_rotas(vendedor_id, rota_config_id, dia_semana) VALUES(?, ?, ?)`,
      [vend.id, rotaId, dia]);
  }
  console.log(`   ✓ 6 Rotas de cronograma semanal e 30 bairros cadastrados.`);

  // 5. Tabelas de Preço Estratégicas
  console.log('6. Cadastrando Tabelas de Preços Comerciais com Itens e Descontos...');
  const tabelasDef = [
    { id: 'tab-atacado-15', nome: 'Atacado Distribuidor (15% OFF)', desc: 0.85, min: 6 },
    { id: 'tab-supermercados-12', nome: 'Supermercados & Grandes Redes (12% OFF)', desc: 0.88, min: 12 },
    { id: 'tab-bares-noturnos-8', nome: 'Bares & Restaurantes Horeca (8% OFF)', desc: 0.92, min: 3 },
    { id: 'tab-padarias-5', nome: 'Padarias & Lanchonetes (5% OFF)', desc: 0.95, min: 2 },
    { id: 'tab-conveniencias', nome: 'Conveniências & Postos 24h (Especial)', desc: 0.90, min: 4 }
  ];

  tabelasDef.forEach(t => {
    run(`INSERT OR REPLACE INTO tabelas_preco(id, nome, ativo) VALUES(?, ?, 1)`, [t.id, t.nome]);
    // Cadastra preços especiais para 150 produtos reais
    produtosReais.slice(0, 150).forEach(p => {
      const precoEspecial = Number((p.preco_base * t.desc).toFixed(2));
      run(`INSERT OR REPLACE INTO tabela_preco_itens(id, tabela_id, produto_id, preco, quantidade_minima) VALUES(?, ?, ?, ?, ?)`,
        [id(), t.id, p.id, precoEspecial, t.min]);
    });
  });
  console.log(`   ✓ 5 Tabelas de preço com itens e regras de volume configuradas.`);

  // 6. Fornecedores e Pedidos de Compra (Inbound) com Recebimentos Parciais e Concluídos
  console.log('7. Cadastrando Fornecedores e Pedidos de Compra com Recebimentos...');
  const fornecedoresNomes = [
    { nome: 'Ambev Distribuição S/A', fantasia: 'Ambev Valadares', cnpj: '07.526.557/0001-00', cidade: 'Governador Valadares', uf: 'MG', lead: 3 },
    { nome: 'Coca-Cola FEMSA Brasil Ltda', fantasia: 'FEMSA Brasil', cnpj: '17.345.678/0001-11', cidade: 'Belo Horizonte', uf: 'MG', lead: 4 },
    { nome: 'Heineken Brasil Distribuidora de Bebidas', fantasia: 'Heineken Brasil', cnpj: '02.456.789/0001-22', cidade: 'Araraquara', uf: 'SP', lead: 5 },
    { nome: 'Laticínios Ibituruna S/A', fantasia: 'Ibituruna Alimentos', cnpj: '21.567.890/0001-33', cidade: 'Governador Valadares', uf: 'MG', lead: 2 },
    { nome: 'Polpas e Frutas do Vale Ltda', fantasia: 'Frutas do Vale', cnpj: '19.678.901/0001-44', cidade: 'Ipatinga', uf: 'MG', lead: 3 },
    { nome: 'Indústria e Comércio de Embalagens PlastValle', fantasia: 'PlastValle Embalagens', cnpj: '25.789.012/0001-55', cidade: 'Governador Valadares', uf: 'MG', lead: 3 },
    { nome: 'Baly Bebidas Brasil Eireli', fantasia: 'Baly Energy Drink', cnpj: '08.890.123/0001-66', cidade: 'Tubarão', uf: 'SC', lead: 6 },
    { nome: 'Destilaria e Engenho Serra Morena Ltda', fantasia: 'Engenho Serra Morena', cnpj: '14.901.234/0001-77', cidade: 'Salinas', uf: 'MG', lead: 4 },
    { nome: 'Minalba Brasil Bebidas S/A', fantasia: 'Minalba Águas', cnpj: '05.012.345/0001-88', cidade: 'Campos do Jordão', uf: 'SP', lead: 5 },
    { nome: 'Mondelez Brasil Chocolates e Doces', fantasia: 'Mondelez Brasil', cnpj: '33.123.456/0001-99', cidade: 'Curitiba', uf: 'PR', lead: 6 },
    { nome: 'Vinhos & Vinícola Vale do Sol', fantasia: 'Vinícola Vale do Sol', cnpj: '09.234.567/0001-10', cidade: 'Bento Gonçalves', uf: 'RS', lead: 7 },
    { nome: 'Distribuidora Central de Descartáveis Minas', fantasia: 'Minas Descartáveis', cnpj: '18.345.678/0001-20', cidade: 'Governador Valadares', uf: 'MG', lead: 2 },
    { nome: 'Red Bull do Brasil Distribuidora', fantasia: 'Red Bull Brasil', cnpj: '04.456.789/0001-30', cidade: 'São Paulo', uf: 'SP', lead: 4 },
    { nome: 'Xaropes e Essências Tropicais Brasil', fantasia: 'Tropicais Essências', cnpj: '12.567.890/0001-40', cidade: 'Campinas', uf: 'SP', lead: 5 },
    { nome: 'Campari do Brasil Bebidas Ltda', fantasia: 'Grupo Campari', cnpj: '50.678.901/0001-50', cidade: 'Sorocaba', uf: 'SP', lead: 5 }
  ];

  const fornecedoresCriados = [];
  fornecedoresNomes.forEach((fn, idx) => {
    const fid = id();
    run(`INSERT INTO fornecedores(id, nome, razao_social, nome_fantasia, cnpj_cpf, contato_nome, telefone_whatsapp, email, endereco, cidade, estado, cep, lead_time_padrao_dias, condicoes_pagamento, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '35010-000', ?, 'Boleto 28/42 dias', 1)`,
      [
        fid, fn.nome, fn.nome, fn.fantasia, fn.cnpj,
        `Gerente Comercial ${idx + 1}`,
        `(33) 987${String(idx + 10).padStart(2, '0')}-0000`,
        `vendas@${fn.fantasia.toLowerCase().replace(/[^a-z0-9]/g, '')}.com.br`,
        `Distrito Industrial GV, Quadra ${idx + 1}, Lote 10`,
        fn.cidade, fn.uf, fn.lead
      ]);
    fornecedoresCriados.push({ id: fid, ...fn });

    // Vincula produtos reais ao fornecedor
    const sliceProd = produtosReais.slice(idx * 30, (idx + 1) * 30);
    sliceProd.forEach(p => {
      const custo = Number((p.preco_base * 0.65).toFixed(2));
      run(`INSERT OR IGNORE INTO fornecedor_produtos(id, fornecedor_id, produto_id, codigo_referencia_fornecedor, custo_aquisicao, lead_time_dias, quantidade_minima_compra, preferencial, ativo)
           VALUES(?, ?, ?, ?, ?, ?, 10, 1, 1)`,
        [id(), fid, p.id, `REF-FORN-${p.sku || p.id.slice(0, 6)}`, custo, fn.lead]);
    });
  });

  // Pedidos de compra em todos os status: PENDENTE, CONFIRMADO, A_CAMINHO, RECEBIDO_PARCIAL, CONCLUIDO
  const statusCompras = ['PENDENTE', 'CONFIRMADO', 'A_CAMINHO', 'RECEBIDO_PARCIAL', 'CONCLUIDO', 'CONCLUIDO', 'RECEBIDO_PARCIAL', 'CONCLUIDO'];
  for (let i = 1; i <= 32; i++) {
    const cid = id();
    const st = statusCompras[i % statusCompras.length];
    const forn = fornecedoresCriados[i % fornecedoresCriados.length];
    const num = `OC-2026-${String(i).padStart(5, '0')}`;
    const nf = (st === 'CONCLUIDO' || st === 'RECEBIDO_PARCIAL') ? `NF-e ${50000 + i}` : null;
    const chaveNfe = nf ? `31260407526557000100550010000${50000 + i}1234567890` : null;
    const diasAtras = (32 - i);
    const dataEmissao = new Date(Date.now() - diasAtras * 86400000).toISOString();
    const previsao = new Date(Date.now() - (diasAtras - forn.lead) * 86400000).toISOString().slice(0, 10);
    const dataConclusao = (st === 'CONCLUIDO') ? new Date(Date.now() - (diasAtras - forn.lead) * 86400000).toISOString() : null;

    let totalCompra = 0;
    const prodsDoForn = all('SELECT produto_id, custo_aquisicao FROM fornecedor_produtos WHERE fornecedor_id=?', [forn.id]);
    const itensEscolhidos = prodsDoForn.slice(0, Math.min(prodsDoForn.length, 4));

    itensEscolhidos.forEach(it => {
      totalCompra += it.custo_aquisicao * 100;
    });

    run(`INSERT INTO compras(id, numero, fornecedor_id, comprador_id, status, data_emissao, previsao_entrega, data_conclusao, valor_total, numero_nota_fiscal, chave_acesso_nfe, observacoes)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cid, num, forn.id, mainAdminId, st, dataEmissao, previsao, dataConclusao, Number(totalCompra.toFixed(2)), nf, chaveNfe, `Pedido de suprimentos ${num} - ${forn.fantasia}`]);

    itensEscolhidos.forEach(it => {
      const qPedida = 100;
      let qRecebida = 0;
      if (st === 'CONCLUIDO') qRecebida = qPedida;
      else if (st === 'RECEBIDO_PARCIAL') qRecebida = 50;

      const sub = Number((it.custo_aquisicao * qPedida).toFixed(2));
      run(`INSERT INTO compra_itens(id, compra_id, produto_id, quantidade_pedida, quantidade_recebida, custo_unitario, subtotal)
           VALUES(?, ?, ?, ?, ?, ?, ?)`,
        [id(), cid, it.produto_id, qPedida, qRecebida, it.custo_aquisicao, sub]);

      // Movimentação de estoque de recebimento se houve entrega
      if (qRecebida > 0) {
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'ENTRADA_COMPRA', ?, 500, ?, ?, ?)`,
          [id(), it.produto_id, qRecebida, 500 + qRecebida, mainAdminId, `Recebimento ${st === 'RECEBIDO_PARCIAL' ? 'Parcial' : 'Total'} ${num} - NF: ${nf}`]);
      }
    });
  }
  console.log(`   ✓ 15 fornecedores homologados e 32 pedidos de compra com recebimentos parciais e totais.`);

  // 7. Centenas de Clientes B2B e Web
  console.log('8. Cadastrando Centenas de Clientes Comerciais em Todos os Bairros de GV...');
  const tiposComercio = [
    'Supermercado', 'Padaria & Confeitaria', 'Restaurante & Grill', 'Bar & Espeteria',
    'Mercearia & Armazém', 'Lanchonete & Sucos', 'Churrascaria', 'Adega & Distribuidora',
    'Conveniência Posto', 'Pizzaria', 'Hamburgueria Artesanal', 'Hotel & Pousada',
    'Empório Gourmet', 'Clube Recreativo', 'Buffet & Eventos', 'Mercado de Bairro'
  ];

  const clientesCriados = [];
  const tabelasIds = ['tab-atacado-15', 'tab-supermercados-12', 'tab-bares-noturnos-8', 'tab-padarias-5', 'tab-conveniencias', null];

  // 360 Clientes Comerciais B2B
  for (let c = 1; c <= 360; c++) {
    const cid = id();
    const bInfo = bairrosGV[c % bairrosGV.length];
    const tipo = tiposComercio[c % tiposComercio.length];
    const vend = uVendedores[c % uVendedores.length];
    const tabId = tabelasIds[c % tabelasIds.length];

    const latVariada = Number((bInfo.lat + (Math.random() - 0.5) * 0.008).toFixed(6));
    const lngVariada = Number((bInfo.lng + (Math.random() - 0.5) * 0.008).toFixed(6));
    const cnpj = `${String((c % 80) + 10).padStart(2, '0')}.${String(c * 3).padStart(3, '0')}.${String(c * 7).padStart(3, '0')}/0001-${String((c % 90) + 10)}`;
    const tel = `(33) 9${Math.floor(Math.random() * 8000 + 1000)}-${Math.floor(Math.random() * 8000 + 1000)}`;
    const razao = `${tipo} ${bInfo.nome} Ltda ${c}`;
    const fantasia = `${tipo} ${bInfo.nome} #${c}`;

    run(`INSERT INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, telefone, email, endereco, bairro, cidade, estado, latitude, longitude, tabela_preco_id, vendedor_id, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Governador Valadares', 'MG', ?, ?, ?, ?, 1)`,
      [
        cid, razao, fantasia, cnpj, tel,
        `compras.cli${c}@gvnegocios.com.br`,
        `Avenida Principal, ${c * 10}`,
        bInfo.nome,
        latVariada, lngVariada, tabId, vend.id
      ]);
    clientesCriados.push({ id: cid, razao, fantasia, bairro: bInfo.nome, vendedor_id: vend.id, tabela_preco_id: tabId });
  }

  // 50 Clientes Web vinculados aos usuários da Loja Online
  const clientesWebCriados = [];
  uWeb.forEach((wUser, idx) => {
    const cid = id();
    const bInfo = bairrosGV[idx % bairrosGV.length];
    const latVariada = Number((bInfo.lat + (Math.random() - 0.5) * 0.008).toFixed(6));
    const lngVariada = Number((bInfo.lng + (Math.random() - 0.5) * 0.008).toFixed(6));
    const cpf = `0${String(idx + 10).padStart(2, '0')}.${String(idx * 7).padStart(3, '0')}.${String(idx * 13).padStart(3, '0')}-${String((idx % 90) + 10)}`;

    run(`INSERT INTO clientes(id, razao_social, nome_fantasia, cnpj_cpf, telefone, email, endereco, bairro, cidade, estado, latitude, longitude, tabela_preco_id, vendedor_id, ativo)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'Governador Valadares', 'MG', ?, ?, NULL, NULL, 1)`,
      [
        cid, `Cliente Online - ${wUser.nome}`, wUser.nome, cpf, wUser.tel, wUser.email,
        `Rua Residencial, ${100 + idx * 8}`, bInfo.nome, latVariada, lngVariada
      ]);

    run(`INSERT INTO usuario_clientes(usuario_id, cliente_id) VALUES(?, ?)`, [wUser.id, cid]);
    clientesWebCriados.push({ id: cid, nome: wUser.nome, usuario_id: wUser.id, bairro: bInfo.nome });
  });
  console.log(`   ✓ ${clientesCriados.length} clientes B2B e ${clientesWebCriados.length} clientes da Loja Online cadastrados.`);

  // 8. Interações de CRM
  console.log('9. Gerando mais de 150 Interações de CRM com Linha do Tempo e Acompanhamento...');
  const crmModelos = [
    { tipo: 'VISITA', desc: 'Visita presencial do vendedor. Apresentação das novas tabelas de atacado e fardos de cerveja e energéticos. Pedido emitido no local.' },
    { tipo: 'WHATSAPP', desc: 'Cotação e confirmação semanal de reposição via WhatsApp. Cliente fechou grade mista de destilados e refrigerantes.' },
    { tipo: 'LIGACAO', desc: 'Contato telefônico de rotina para verificação de estoque antes da rota do dia. Programado envio matutino.' },
    { tipo: 'VISITA', desc: 'Alinhamento com o gerente de compras sobre o volume para eventos do final de semana. Aprovada condição especial.' },
    { tipo: 'COBRANCA', desc: 'Confirmação de recebimento de nota fiscal e liquidação de boleto bancário. Situação financeira regularizada.' },
    { tipo: 'OBSERVACAO', desc: 'Cliente expandiu área de mesas e passará a pedir grades completas de cervejas duas vezes por semana.' }
  ];

  clientesCriados.slice(0, 160).forEach((cli, idx) => {
    const qtd = Math.floor(Math.random() * 2) + 1;
    for (let k = 0; k < qtd; k++) {
      const mod = crmModelos[(idx + k) % crmModelos.length];
      const diasAtras = (k * 7) + (idx % 15);
      const dataIso = new Date(Date.now() - diasAtras * 86400000).toISOString();
      run(`INSERT INTO cliente_interacoes(id, cliente_id, usuario_id, tipo, descricao, created_at)
           VALUES(?, ?, ?, ?, ?, ?)`,
        [id(), cli.id, cli.vendedor_id, mod.tipo, mod.desc, dataIso]);
    }
  });
  console.log(`   ✓ Linha do tempo CRM populada.`);

  // 9. Centenas de Pedidos de Venda em Todas as Origens e Status
  console.log('10. Gerando 450 Pedidos de Venda usando os Produtos Reais Cadastrados...');
  // Assegura estoque inicial generoso para suportar centenas de vendas
  run('UPDATE estoque SET quantidade_disponivel = 2000, quantidade_reservada = 0, estoque_minimo = 25');

  const formasPagamento = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'];
  const modalidadesCredito = ['A_VISTA', 'PARCELADO'];

  function emitirPedidoVolume({ origem, operadorId, cliente, status, diasAtras = 0, modalidadeEntrega = 'ENTREGA' }) {
    const pid = id();
    const d = new Date(Date.now() - diasAtras * 86400000);
    const dataIso = d.toISOString();
    const ano = d.getFullYear();
    const seq = Math.floor(Math.random() * 900000) + 100000;
    const num = `XV-${ano}-${seq}`;

    const forma = formasPagamento[Math.floor(Math.random() * formasPagamento.length)];
    let pagStatus = (status === 'CONCLUIDO') ? 'RECEBIDO' : (status === 'CANCELADO' ? 'NAO_RECEBIDO' : ((Math.random() > 0.4) ? 'RECEBIDO' : 'NAO_RECEBIDO'));
    let cartaoMod = (forma === 'CREDITO') ? modalidadesCredito[Math.floor(Math.random() * modalidadesCredito.length)] : null;
    let parcelas = (cartaoMod === 'PARCELADO') ? Math.floor(Math.random() * 5) + 2 : 1;

    // Itens do pedido (1 a 5 produtos reais)
    const qtdLinhas = Math.floor(Math.random() * 4) + 1;
    let subtotalBruto = 0;
    const itensEscolhidos = [];

    for (let k = 0; k < qtdLinhas; k++) {
      const prod = produtosReais[Math.floor(Math.random() * produtosReais.length)];
      const qtd = Math.floor(Math.random() * 10) + 1;

      let preco = prod.preco_base;
      if (cliente.tabela_preco_id) {
        const rowTab = one('SELECT preco FROM tabela_preco_itens WHERE tabela_id=? AND produto_id=?', [cliente.tabela_preco_id, prod.id]);
        if (rowTab) preco = Number(rowTab.preco);
      }

      const sub = Number((preco * qtd).toFixed(2));
      subtotalBruto += sub;
      itensEscolhidos.push({ prod, qtd, preco, sub });
    }

    const descValor = (subtotalBruto > 200 && Math.random() > 0.5) ? Number((subtotalBruto * 0.05).toFixed(2)) : 0;
    const total = Number(Math.max(0, subtotalBruto - descValor).toFixed(2));
    const recebido = (forma === 'DINHEIRO') ? Math.ceil(total / 10) * 10 : null;
    const troco = (recebido && recebido > total) ? Number((recebido - total).toFixed(2)) : 0;

    let cancelAt = null, cancelBy = null, cancelReason = null;
    if (status === 'CANCELADO') {
      cancelAt = dataIso;
      cancelBy = operadorId || mainAdminId;
      cancelReason = 'Cancelado a pedido do cliente antes da expedição.';
    }

    run(`INSERT INTO pedidos(id, numero, cliente_id, operador_id, origem, status, subtotal_bruto, desconto_tipo, desconto_valor, total, forma_pagamento, pagamento_status, valor_recebido, troco, cartao_modalidade, parcelas, modalidade_entrega, cancelled_at, cancelled_by, cancel_reason, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, 'VALOR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pid, num, cliente.id, operadorId, origem,
        status === 'CANCELADO' ? 'PENDENTE' : status,
        subtotalBruto, descValor, total, forma, pagStatus, recebido, troco, cartaoMod, parcelas, modalidadeEntrega,
        cancelAt, cancelBy, cancelReason, dataIso, dataIso
      ]);

    itensEscolhidos.forEach(it => {
      run(`INSERT INTO pedido_itens(id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, subtotal)
           VALUES(?, ?, ?, ?, ?, ?)`,
        [id(), pid, it.prod.id, it.qtd, it.preco, it.sub]);

      const stRow = one('SELECT quantidade_disponivel, quantidade_reservada FROM estoque WHERE produto_id=?', [it.prod.id]);
      const disp = stRow?.quantidade_disponivel || 2000;

      if (status === 'CONCLUIDO') {
        run('UPDATE estoque SET quantidade_disponivel = MAX(0, quantidade_disponivel - ?) WHERE produto_id = ?', [it.qtd, it.prod.id]);
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'SAIDA_VENDA', ?, ?, ?, ?, ?)`,
          [id(), it.prod.id, -it.qtd, disp, Math.max(0, disp - it.qtd), operadorId || mainAdminId, `Venda entregue pedido ${num}`]);
      } else if (status !== 'CANCELADO') {
        // PENDENTE, SEPARACAO, ROTA
        run('UPDATE estoque SET quantidade_reservada = quantidade_reservada + ? WHERE produto_id = ?', [it.qtd, it.prod.id]);
        run(`INSERT INTO movimentacoes_estoque(id, produto_id, tipo, quantidade, quantidade_anterior, quantidade_posterior, operador_id, observacao)
             VALUES(?, ?, 'RESERVA', ?, ?, ?, ?, ?)`,
          [id(), it.prod.id, -it.qtd, disp, disp, operadorId || mainAdminId, `Reserva pedido ${num} (${status})`]);
      }
    });

    return { id: pid, num, total, status, cliente, operadorId };
  }

  // 1) 250 Pedidos Concluídos (distribuídos nos últimos 30 dias para gerar histórico de faturamento consistente)
  console.log('   -> Gerando 250 Pedidos Concluídos com faturamento histórico...');
  for (let i = 0; i < 250; i++) {
    const dias = Math.floor(Math.random() * 30);
    const mod = i % 3;
    if (mod === 0) {
      // Vendedor externo
      const cli = clientesCriados[i % clientesCriados.length];
      emitirPedidoVolume({ origem: 'VENDEDOR', operadorId: cli.vendedor_id, cliente: cli, status: 'CONCLUIDO', diasAtras: dias });
    } else if (mod === 1) {
      // Balcão PDV
      const cx = uCaixas[i % uCaixas.length];
      emitirPedidoVolume({ origem: 'BALCAO', operadorId: cx.id, cliente: { id: 'CLIENTE-BALCAO', tabela_preco_id: null }, status: 'CONCLUIDO', diasAtras: dias, modalidadeEntrega: 'RETIRADA' });
    } else {
      // Loja Online
      const cWeb = clientesWebCriados[i % clientesWebCriados.length];
      emitirPedidoVolume({ origem: 'WEB', operadorId: null, cliente: cWeb, status: 'CONCLUIDO', diasAtras: dias });
    }
  }

  // 2) 75 Pedidos em Separação (prontos para entrega nos próximos dias)
  console.log('   -> Gerando 75 Pedidos em Separação...');
  for (let i = 0; i < 75; i++) {
    const cli = clientesCriados[i % clientesCriados.length];
    const orig = (i % 4 === 0) ? 'WEB' : 'VENDEDOR';
    emitirPedidoVolume({ origem: orig, operadorId: orig === 'WEB' ? null : cli.vendedor_id, cliente: cli, status: 'SEPARACAO', diasAtras: 0 });
  }

  // 3) 50 Pedidos em Rota (para compor as rotas ativas dos motoristas)
  console.log('   -> Gerando 50 Pedidos em Rota...');
  const pedidosEmRota = [];
  for (let i = 0; i < 50; i++) {
    const cli = clientesCriados[(i + 100) % clientesCriados.length];
    const p = emitirPedidoVolume({ origem: 'VENDEDOR', operadorId: cli.vendedor_id, cliente: cli, status: 'ROTA', diasAtras: 0 });
    pedidosEmRota.push(p);
  }

  // 4) 55 Pedidos Pendentes (aguardando separação)
  console.log('   -> Gerando 55 Pedidos Pendentes...');
  for (let i = 0; i < 55; i++) {
    const cli = clientesCriados[(i + 200) % clientesCriados.length];
    const orig = (i % 3 === 0) ? 'WEB' : 'VENDEDOR';
    emitirPedidoVolume({ origem: orig, operadorId: orig === 'WEB' ? null : cli.vendedor_id, cliente: cli, status: 'PENDENTE', diasAtras: 0 });
  }

  // 5) 20 Pedidos Cancelados
  console.log('   -> Gerando 20 Pedidos Cancelados com justificativa...');
  for (let i = 0; i < 20; i++) {
    const cli = clientesCriados[i % clientesCriados.length];
    emitirPedidoVolume({ origem: 'VENDEDOR', operadorId: cli.vendedor_id, cliente: cli, status: 'CANCELADO', diasAtras: Math.floor(Math.random() * 15) });
  }

  // 11. Montagem de Rotas Logísticas com Motoristas, Comprovantes e Devoluções
  console.log('11. Criando Rotas Logísticas (Em Trânsito, Concluídas, Comprovantes de Entrega e Devoluções)...');
  const hoje = new Date().toISOString().slice(0, 10);

  // A) 4 Rotas EM_ROTA ativas hoje com os 50 pedidos distribuídos
  for (let r = 0; r < 4; r++) {
    const rotaId = id();
    const mot = uMotoristas[r];
    const pedFatia = pedidosEmRota.slice(r * 12, (r + 1) * 12);
    const pedIds = pedFatia.map(p => p.id);

    run(`INSERT INTO rotas_logistica(id, motorista_id, data, status, sequencia_json, distance_km, estimated_minutes)
         VALUES(?, ?, ?, 'EM_ROTA', ?, 18.5, 55)`,
      [rotaId, mot.id, hoje, JSON.stringify(pedIds)]);

    pedIds.forEach((pid, ordem) => {
      run(`INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)`, [rotaId, pid, ordem + 1]);
    });

    // Registra 1 retorno/devolução para demonstrar o fluxo de logística reversa
    if (r === 0 || r === 1) {
      const pedRet = pedFatia[0];
      run(`INSERT INTO pedido_retornos(id, pedido_id, rota_id, motorista_id, motivo, descricao)
           VALUES(?, ?, ?, ?, 'ESTABELECIMENTO_FECHADO', 'Estabelecimento estava fechado no momento da tentativa de entrega. Reagendado.')`,
        [id(), pedRet.id, rotaId, mot.id]);
    }
  }

  // B) 4 Rotas CONCLUIDAS nos dias anteriores com comprovantes de entrega assinados
  for (let r = 0; r < 4; r++) {
    const rotaId = id();
    const mot = uMotoristas[r + 4];
    const dataPassada = new Date(Date.now() - (r + 1) * 86400000).toISOString().slice(0, 10);

    // Seleciona pedidos concluídos para associar
    const concluidosSample = all("SELECT id FROM pedidos WHERE status='CONCLUIDO' AND modalidade_entrega='ENTREGA' LIMIT 8 OFFSET ?", [r * 8]);
    const pedIds = concluidosSample.map(p => p.id);

    run(`INSERT INTO rotas_logistica(id, motorista_id, data, status, sequencia_json, distance_km, estimated_minutes)
         VALUES(?, ?, ?, 'CONCLUIDA', ?, 14.2, 45)`,
      [rotaId, mot.id, dataPassada, JSON.stringify(pedIds)]);

    pedIds.forEach((pid, ordem) => {
      run(`INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)`, [rotaId, pid, ordem + 1]);
      run(`INSERT INTO comprovantes_entrega(id, pedido_id, motorista_id, arquivo_path)
           VALUES(?, ?, ?, 'proofs/comprovante_demonstracao.jpg')`,
        [id(), pid, mot.id]);
    });
  }

  // 12. Reconciliação final do estoque
  console.log('12. Executando Reconciliação Matemática Perfeita do Estoque...');
  db.exec(`
    UPDATE estoque 
    SET quantidade_reservada = (
      SELECT COALESCE(SUM(pi.quantidade), 0)
      FROM pedido_itens pi
      JOIN pedidos p ON p.id = pi.pedido_id
      WHERE pi.produto_id = estoque.produto_id
        AND p.cancelled_at IS NULL
        AND p.status IN ('PENDENTE', 'SEPARACAO', 'ROTA')
    )
  `);

  console.log('\n=== Carga Corporativa Concluída com Sucesso! ===');
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
});
