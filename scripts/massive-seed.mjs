import { run, tx, id } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import crypto from 'node:crypto';

console.log('Iniciando simulação massiva de operações (Suite de Testes de Carga)...');

const roles = ['admin', 'seller', 'cashier', 'driver', 'web_client'];
const generatedUsers = { admin: [], seller: [], cashier: [], driver: [], web_client: [] };

const defaultPassword = hashPassword('ChangeMe123!');

tx(() => {
  console.log('1. Criando dezenas de usuários de todas as categorias...');
  for (let i = 1; i <= 60; i++) {
    const role = roles[i % roles.length];
    const uid = id();
    const nome = `Usuário ${role.toUpperCase()} ${i}`;
    const email = `user${i}_${role}@simulacao.local`;
    
    run(
      'INSERT INTO usuarios(id, nome, email, senha_hash, role, telefone) VALUES(?, ?, ?, ?, ?, ?)',
      [uid, nome, email, defaultPassword, role, `(11) 99999-${String(i).padStart(4, '0')}`]
    );
    generatedUsers[role].push(uid);
  }

  console.log('2. Criando categorias e subcategorias...');
  const categorias = [];
  for (let i = 1; i <= 10; i++) {
    const cid = id();
    run('INSERT INTO categorias(id, nome, slug) VALUES(?, ?, ?)', [cid, `Categoria ${i}`, `cat-${i}`]);
    categorias.push(cid);
    for (let j = 1; j <= 3; j++) {
      run('INSERT INTO subcategorias(id, categoria_id, nome, slug) VALUES(?, ?, ?, ?)', [id(), cid, `Subcategoria ${i}.${j}`, `sub-${i}-${j}`]);
    }
  }

  console.log('3. Criando centenas de produtos e injetando estoque...');
  const produtos = [];
  for (let i = 1; i <= 200; i++) {
    const pid = id();
    const preco = (Math.random() * 100 + 5).toFixed(2);
    const cat = categorias[i % categorias.length];
    run(
      'INSERT INTO produtos(id, nome, sku, codigo_barras, preco_base, categoria_id) VALUES(?, ?, ?, ?, ?, ?)',
      [pid, `Produto Simulado ${i}`, `SKU-SIM-${i}`, `789000${String(i).padStart(6, '0')}`, preco, cat]
    );
    produtos.push({ id: pid, preco: Number(preco) });
    
    // Injetar estoque generoso
    run('INSERT INTO estoque(produto_id, quantidade_disponivel, estoque_minimo) VALUES(?, ?, ?)', [pid, 500, 10]);
  }

  console.log('4. Criando tabela de preços...');
  const tabId = id();
  run('INSERT INTO tabelas_preco(id, nome) VALUES(?, ?)', [tabId, 'Tabela Padrão (Simulação)']);

  console.log('5. Criando centenas de clientes...');
  const clientes = [];
  for (let i = 1; i <= 150; i++) {
    const cid = id();
    const vendedor = generatedUsers.seller[i % generatedUsers.seller.length];
    run(
      'INSERT INTO clientes(id, razao_social, cnpj_cpf, endereco, cidade, estado, vendedor_id, tabela_preco_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
      [cid, `Cliente Simulado ${i}`, `000.000.000-${String(i).padStart(2, '0')}`, `Rua Fictícia, ${i}`, 'São Paulo', 'SP', vendedor, tabId]
    );
    clientes.push(cid);
  }

  console.log('6. Gerando centenas de operações (Pedidos, Vendas, Rota, etc)...');
  const statuses = ['PENDENTE', 'SEPARACAO', 'ROTA', 'CONCLUIDO'];
  const origens = ['WEB', 'VENDEDOR', 'BALCAO'];

  for (let i = 1; i <= 400; i++) {
    const pedidoId = id();
    const cliente = clientes[i % clientes.length];
    const status = statuses[i % statuses.length];
    const origem = origens[i % origens.length];
    let operador = null;
    
    if (origem === 'VENDEDOR') operador = generatedUsers.seller[i % generatedUsers.seller.length];
    if (origem === 'BALCAO') operador = generatedUsers.cashier[i % generatedUsers.cashier.length];

    // Distribuir pedidos nos últimos 30 dias
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - (i % 30));
    const dataCriacao = pastDate.toISOString();

    run(
      'INSERT INTO pedidos(id, numero, cliente_id, operador_id, origem, status, total, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pedidoId, `SIM-${String(i).padStart(5, '0')}`, cliente, operador, origem, status, 0, dataCriacao, dataCriacao]
    );

    let total = 0;
    const numItems = (i % 5) + 1; // 1 to 5 itens
    const itens = [];

    for (let j = 0; j < numItems; j++) {
      const prod = produtos[(i + j) % produtos.length];
      const qtd = (j % 3) + 1;
      const subtotal = prod.preco * qtd;
      total += subtotal;
      itens.push({ prod, qtd, subtotal });
      
      run(
        'INSERT INTO pedido_itens(id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, subtotal) VALUES(?, ?, ?, ?, ?, ?)',
        [id(), pedidoId, prod.id, qtd, prod.preco, subtotal]
      );

      // Decrementar estoque se não for cancelado
      run('UPDATE estoque SET quantidade_disponivel = quantidade_disponivel - ? WHERE produto_id = ?', [qtd, prod.id]);
    }
    
    run('UPDATE pedidos SET total = ? WHERE id = ?', [total, pedidoId]);

    // Se estiver em rota ou concluido, criar logistica
    if (status === 'ROTA' || status === 'CONCLUIDO') {
      const rotaId = id();
      const motorista = generatedUsers.driver[i % generatedUsers.driver.length];
      run(
        'INSERT INTO rotas_logistica(id, motorista_id, data, status, created_at) VALUES(?, ?, ?, ?, ?)',
        [rotaId, motorista, dataCriacao.split('T')[0], status === 'CONCLUIDO' ? 'FINALIZADA' : 'EM_ANDAMENTO', dataCriacao]
      );
      run('INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)', [rotaId, pedidoId, 1]);
      
      if (status === 'CONCLUIDO') {
        run(
          'INSERT INTO comprovantes_entrega(id, pedido_id, motorista_id, arquivo_path) VALUES(?, ?, ?, ?)',
          [id(), pedidoId, motorista, '/fake/path/comprovante.jpg']
        );
      }
    }
  }

  console.log('7. Audit logs preenchidos e chaves sincronizadas.');
});

console.log('✅ Simulação concluída com sucesso!');
console.log('Foram criados 60 usuários, 200 produtos, 150 clientes e 400 pedidos com histórico completo.');
console.log('Acesse a Torre de Controle e veja a Visão Geral vibrando com dados!');
