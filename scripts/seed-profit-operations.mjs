import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = path.resolve(process.cwd());
const dbPath = path.join(ROOT, 'storage', 'xiquim-vargas.db');
const db = new DatabaseSync(dbPath);

console.log(`[SEED] Conectando ao banco SQLite: ${dbPath}`);

// Helpers
function uid(prefix = '') {
  return (prefix ? prefix + '-' : '') + crypto.randomUUID();
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatIso(d) {
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

// 1. Carregar produtos existentes
const produtos = db.prepare(`SELECT id, nome, preco_base, categoria_id FROM produtos WHERE ativo = 1`).all();
console.log(`[SEED] Encontrados ${produtos.length} produtos ativos.`);

if (produtos.length === 0) {
  console.error('[SEED] Nenhum produto ativo encontrado para criar histórico!');
  process.exit(1);
}

// 2. Carregar fornecedores e clientes existentes
let fornecedores = db.prepare(`SELECT id, nome FROM fornecedores`).all();
if (fornecedores.length === 0) {
  console.log('[SEED] Criando fornecedores realistas...');
  const novosForn = [
    { nome: 'Ambev Distribuidora Regional', razao: 'Ambev Brasil Ltda', cnpj: '02.808.708/0001-07' },
    { nome: 'Coca-Cola FEMSA Distribuição', razao: 'Spal Indústria Brasileira de Bebidas S/A', cnpj: '61.450.292/0001-44' },
    { nome: 'Distribuidora Central de Alimentos e Bebidas', razao: 'Central Bebidas SP Ltda', cnpj: '11.222.333/0001-99' },
    { nome: 'Atacadão de Bebidas do Vale', razao: 'Vale Comercial de Bebidas Eireli', cnpj: '22.333.444/0001-88' },
  ];
  for (const f of novosForn) {
    const fid = uid('FORN');
    db.prepare(`
      INSERT INTO fornecedores(id, nome, razao_social, cnpj_cpf, lead_time_padrao_dias, ativo)
      VALUES (?, ?, ?, ?, 3, 1)
    `).run(fid, f.nome, f.razao, f.cnpj);
  }
  fornecedores = db.prepare(`SELECT id, nome FROM fornecedores`).all();
}

const clientes = db.prepare(`SELECT id, razao_social, nome_fantasia FROM clientes WHERE ativo = 1`).all();
const usuarios = db.prepare(`SELECT id, nome, role FROM usuarios WHERE ativo = 1`).all();
const admin = usuarios.find(u => u.role === 'admin') || usuarios[0];
const sellers = usuarios.filter(u => u.role === 'seller');
const sellerId = sellers.length ? sellers[0].id : admin.id;

console.log(`[SEED] ${fornecedores.length} fornecedores, ${clientes.length} clientes, ${usuarios.length} usuários disponíveis.`);

// 3. Definir cronologia dos últimos 90 dias
const now = new Date();
const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
const d60 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
const d10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

// Limpar dados anteriores de testes de custos e pedidos simulados caso existam para deixar limpo e consistente
db.exec(`BEGIN TRANSACTION;`);

try {
  // Configurar para cada produto 3 ou 4 épocas de custo com base realista:
  // Preço de venda (preco_base):
  // Custo base: tipicamente 50% a 68% do preço de venda (margem bruta de 32% a 50%)
  console.log('[SEED] Gerando histórico de custos e compras ao longo dos últimos 90 dias...');

  const productCostSchedule = new Map();

  for (const prod of produtos) {
    const precoBase = prod.preco_base > 0 ? prod.preco_base : 12.0;
    // Margem alvo realista entre 32% e 48% -> Custo = PrecoBase * (0.52 ~ 0.68)
    const ratioBase = 0.55 + (Math.random() * 0.12); // ~55% a 67%
    const c0 = Number((precoBase * ratioBase).toFixed(2)); // Custo há 90 dias
    const c1 = Number((c0 * 1.05).toFixed(2));              // +5% aumento por fornecedor há 60 dias (COMPRA)
    const c2 = Number((c1 * 1.04).toFixed(2));              // +4% inflação/custo logístico há 30 dias (COMPRA)
    const c3 = Number((c2 * (Math.random() > 0.5 ? 0.98 : 1.03)).toFixed(2)); // reajuste recente há 10 dias (AJUSTE_MANUAL ou COMPRA)

    const schedule = [
      { start: d90, end: d60, custo: c0, tipo: 'INICIAL', motivo: 'Custo inicial de implantação' },
      { start: d60, end: d30, custo: c1, tipo: 'COMPRA', motivo: 'Entrada NFe Fornecedor Reajuste Trimestral' },
      { start: d30, end: d10, custo: c2, tipo: 'COMPRA', motivo: 'Repasse tabela distribuidor' },
      { start: d10, end: null, custo: c3, tipo: 'AJUSTE_MANUAL', motivo: 'Negociação direta com fabricante' }
    ];

    productCostSchedule.set(prod.id, schedule);

    // Atualiza tabela produtos com o custo atual ativo (c3)
    db.prepare(`UPDATE produtos SET preco_custo = ? WHERE id = ?`).run(c3, prod.id);

    // Registra fornecedor_produto
    const forn = pick(fornecedores);
    db.prepare(`
      INSERT OR REPLACE INTO fornecedor_produtos(id, fornecedor_id, produto_id, custo_aquisicao, lead_time_dias, preferencial, ativo)
      VALUES (?, ?, ?, ?, 3, 1, 1)
    `).run(uid('FP'), forn.id, prod.id, c3);

    // Insere registros na linha do tempo produto_custos_historico
    for (const item of schedule) {
      db.prepare(`
        INSERT INTO produto_custos_historico(id, produto_id, custo, tipo_ajuste, origem_id, motivo, data_inicio, data_fim, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uid('PCH'),
        prod.id,
        item.custo,
        item.tipo,
        item.tipo === 'COMPRA' ? uid('NF') : null,
        item.motivo,
        formatIso(item.start),
        item.end ? formatIso(item.end) : null,
        admin.id
      );
    }
  }

  // Função auxiliar para determinar o custo exato que estava em vigor na data do pedido
  function getCostAtDate(productId, date) {
    const sched = productCostSchedule.get(productId);
    if (!sched) return 0;
    for (const item of sched) {
      if (date >= item.start && (!item.end || date < item.end)) {
        return item.custo;
      }
    }
    return sched[sched.length - 1].custo;
  }

  // 4. Gerar compras formais concluídas no módulo de compras
  console.log('[SEED] Gerando pedidos de compra concluídos...');
  for (let i = 1; i <= 15; i++) {
    const compId = uid('COMP');
    const compNum = `PC-${1000 + i}`;
    const forn = pick(fornecedores);
    const diasAtras = rand(5, 80);
    const dtEmissao = new Date(now.getTime() - diasAtras * 24 * 60 * 60 * 1000);
    const dtEntrega = new Date(dtEmissao.getTime() + 3 * 24 * 60 * 60 * 1000);

    const prodsCompra = [pick(produtos), pick(produtos), pick(produtos)];
    let totalCompra = 0;

    const itensCompra = prodsCompra.map(p => {
      const q = rand(20, 100);
      const c = getCostAtDate(p.id, dtEmissao);
      const sub = Number((q * c).toFixed(2));
      totalCompra += sub;
      return { produto_id: p.id, qtd: q, custo: c, subtotal: sub };
    });

    db.prepare(`
      INSERT INTO compras(id, numero, fornecedor_id, comprador_id, status, data_emissao, previsao_entrega, data_conclusao, valor_total, numero_nota_fiscal, observacoes, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'CONCLUIDO', ?, ?, ?, ?, ?, 'Carga de estoque programada', ?, ?)
    `).run(
      compId,
      compNum,
      forn.id,
      admin.id,
      formatIso(dtEmissao),
      formatIso(dtEntrega),
      formatIso(dtEntrega),
      totalCompra,
      `NF-${rand(10000, 99999)}`,
      formatIso(dtEmissao),
      formatIso(dtEntrega)
    );

    for (const it of itensCompra) {
      db.prepare(`
        INSERT INTO compra_itens(id, compra_id, produto_id, quantidade_pedida, quantidade_recebida, custo_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uid('CPI'), compId, it.produto_id, it.qtd, it.qtd, it.custo, it.subtotal);
    }
  }

  // 5. Gerar centenas de Pedidos de Venda realistas distribuídos ao longo dos últimos 90 dias
  console.log('[SEED] Gerando ~250 operações de venda com pedidos concluídos...');

  const formasPgto = ['DINHEIRO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO'];
  const origens = ['BALCAO', 'VENDEDOR', 'WEB'];
  const totalOrdersToCreate = 260;

  // Garantir que o cliente padrão de balcão ou clientes normais existam
  const clienteBalcao = clientes.find(c => c.id === 'CLIENTE-BALCAO') || clientes[0];

  for (let i = 1; i <= totalOrdersToCreate; i++) {
    const diasAtras = Math.floor(Math.pow(Math.random(), 1.5) * 88); // distribuição com maior concentração nos últimos 30 dias
    const horasAtras = rand(0, 23);
    const minutosAtras = rand(0, 59);
    const orderDate = new Date(now.getTime() - (diasAtras * 24 * 3600 + horasAtras * 3600 + minutosAtras * 60) * 1000);

    const orderId = uid('PED');
    const orderNum = `PV-${String(20000 + i).padStart(6, '0')}`;
    const origem = pick(origens);
    const cliente = origem === 'BALCAO' ? clienteBalcao : pick(clientes);
    const operador = origem === 'VENDEDOR' ? sellerId : admin.id;
    const modalidade = origem === 'BALCAO' ? 'RETIRADA' : 'ENTREGA';
    const forma = pick(formasPgto);

    // Itens do pedido (1 a 4 produtos diferentes por pedido)
    const numItems = rand(1, 4);
    const selectedProds = [];
    while (selectedProds.length < numItems) {
      const p = pick(produtos);
      if (!selectedProds.some(x => x.id === p.id)) {
        selectedProds.push(p);
      }
    }

    let subtotalBruto = 0;
    const orderItems = [];

    for (const prod of selectedProds) {
      const qtd = rand(1, 12);
      const unitPrice = prod.preco_base > 0 ? prod.preco_base : 15.0;
      // Preço de venda pode ter variação mínima ou desconto promocional
      const precoVenda = Number((unitPrice * (origem === 'BALCAO' ? 0.98 : 1.0)).toFixed(2));
      const subtotalItem = Number((qtd * precoVenda).toFixed(2));
      const custoUnitario = getCostAtDate(prod.id, orderDate);

      subtotalBruto += subtotalItem;
      orderItems.push({
        produto_id: prod.id,
        quantidade: qtd,
        preco_unitario: precoVenda,
        subtotal: subtotalItem,
        custo_unitario: custoUnitario
      });
    }

    subtotalBruto = Number(subtotalBruto.toFixed(2));
    const desconto = rand(0, 10) > 8 ? Number((subtotalBruto * 0.05).toFixed(2)) : 0;
    const totalLiquido = Number((subtotalBruto - desconto).toFixed(2));

    db.prepare(`
      INSERT INTO pedidos(
        id, numero, cliente_id, operador_id, origem, status,
        modalidade_entrega, subtotal_bruto, desconto_tipo, desconto_valor,
        total, forma_pagamento, pagamento_status, valor_recebido, troco,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'CONCLUIDO',
        ?, ?, 'VALOR', ?,
        ?, ?, 'RECEBIDO', ?, 0,
        ?, ?
      )
    `).run(
      orderId,
      orderNum,
      cliente.id,
      operador,
      origem,
      modalidade,
      subtotalBruto,
      desconto,
      totalLiquido,
      forma,
      totalLiquido,
      formatIso(orderDate),
      formatIso(orderDate)
    );

    for (const item of orderItems) {
      db.prepare(`
        INSERT INTO pedido_itens(
          id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, custo_unitario_aplicado, subtotal
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        uid('PIT'),
        orderId,
        item.produto_id,
        item.quantidade,
        item.preco_unitario,
        item.custo_unitario,
        item.subtotal
      );
    }
  }

  db.exec(`COMMIT;`);
  console.log('[SEED] Sucesso! Centenas de transações e histórico de custos foram persistidos.');
} catch (err) {
  db.exec(`ROLLBACK;`);
  console.error('[SEED] Erro durante transação de seed:', err);
  process.exit(1);
}

// 6. Imprimir Resumo Estatístico dos Dados Gerados
const totalPedidos = db.prepare(`SELECT count(*) as c FROM pedidos WHERE status = 'CONCLUIDO'`).get().c;
const totalItens = db.prepare(`SELECT count(*) as c FROM pedido_itens`).get().c;
const totalCustosHist = db.prepare(`SELECT count(*) as c FROM produto_custos_historico`).get().c;
const totaisFinanceiros = db.prepare(`
  SELECT 
    ROUND(SUM(pi.subtotal), 2) as faturamento_total,
    ROUND(SUM(pi.quantidade * pi.custo_unitario_aplicado), 2) as custo_total,
    ROUND(SUM(pi.subtotal) - SUM(pi.quantidade * pi.custo_unitario_aplicado), 2) as lucro_bruto_total,
    ROUND(((SUM(pi.subtotal) - SUM(pi.quantidade * pi.custo_unitario_aplicado)) / SUM(pi.subtotal)) * 100, 2) as margem_pct
  FROM pedido_itens pi
  JOIN pedidos p ON p.id = pi.pedido_id
  WHERE p.status = 'CONCLUIDO'
`).get();

console.log('----------------------------------------------------');
console.log('✅ RELATÓRIO DO SEED EXECUTADO:');
console.log(`- Total de Pedidos Concluídos: ${totalPedidos}`);
console.log(`- Total de Itens Vendidos:     ${totalItens}`);
console.log(`- Registros de Histórico de Custo: ${totalCustosHist}`);
console.log(`- Faturamento Total Acumulado: R$ ${totaisFinanceiros.faturamento_total?.toLocaleString('pt-BR')}`);
console.log(`- Custo Total de Mercadorias:  R$ ${totaisFinanceiros.custo_total?.toLocaleString('pt-BR')}`);
console.log(`- Lucro Bruto Total:           R$ ${totaisFinanceiros.lucro_bruto_total?.toLocaleString('pt-BR')}`);
console.log(`- Margem de Lucro Média:       ${totaisFinanceiros.margem_pct}%`);
console.log('----------------------------------------------------');
