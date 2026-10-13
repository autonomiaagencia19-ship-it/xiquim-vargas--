import { run, tx, id, all } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

console.log('Iniciando Geração de Dados - Governador Valadares...');

const defaultPassword = hashPassword('ChangeMe123!');

const bairros = [
  'Centro', 'Ilha dos Araújos', 'Vila Bretas', 'Santa Rita', 'Lourdes', 
  'São Paulo', 'Grã-Duquesa', 'Morada do Acampamento', 'Altinópolis', 
  'Castanheiras', 'Carapina', 'Esplanada', 'Esperança', 'Santa Paula',
  'Sir', 'Turmalina', 'Vila Mariana'
];

const rotasMapping = [
  { nome: 'Rota 01 - Centro e Ilha', bairros: ['Centro', 'Ilha dos Araújos', 'São Paulo'] },
  { nome: 'Rota 02 - Sul', bairros: ['Vila Bretas', 'Santa Rita', 'Carapina'] },
  { nome: 'Rota 03 - Leste', bairros: ['Lourdes', 'Grã-Duquesa', 'Morada do Acampamento'] },
  { nome: 'Rota 04 - Norte', bairros: ['Altinópolis', 'Castanheiras', 'Esperança'] },
  { nome: 'Rota 05 - Oeste', bairros: ['Esplanada', 'Santa Paula', 'Vila Mariana'] },
  { nome: 'Rota 06 - Expansão', bairros: ['Sir', 'Turmalina'] }
];

tx(() => {
  // Limpeza profunda para recriar o cenário perfeito
  console.log('1. Limpando dados anteriores...');
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
  // Apaga todos os usuários exceto os admins (para não perder o login do usuário)
  run("DELETE FROM usuarios WHERE role != 'admin'");

  console.log('2. Criando Usuários (10 Vendedores, 4 PDVs, 6 Motoristas, 50 Web)...');
  const uVendedores = [];
  const uCaixas = [];
  const uMotoristas = [];
  const uWeb = [];

  for(let i=1; i<=10; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role) VALUES(?, ?, ?, ?, 'seller')", [uid, `Vendedor GV ${i}`, `vendedor${i}@gv.local`, defaultPassword]);
    uVendedores.push(uid);
  }
  for(let i=1; i<=4; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role) VALUES(?, ?, ?, ?, 'cashier')", [uid, `PDV Caixa ${i}`, `caixa${i}@gv.local`, defaultPassword]);
    uCaixas.push(uid);
  }
  for(let i=1; i<=6; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role) VALUES(?, ?, ?, ?, 'driver')", [uid, `Motorista Rota ${i}`, `motorista${i}@gv.local`, defaultPassword]);
    uMotoristas.push(uid);
  }

  console.log('3. Criando Rotas Logísticas Base...');
  const configRotasIds = [];
  rotasMapping.forEach((rotaConf, index) => {
    const rotaId = id();
    run("INSERT INTO rotas_config(id, nome, dia_semana) VALUES(?, ?, ?)", [rotaId, rotaConf.nome, (index % 6) + 1]);
    configRotasIds.push(rotaId);
    rotaConf.bairros.forEach(b => {
      run("INSERT INTO rota_bairros(id, rota_config_id, bairro) VALUES(?, ?, ?)", [id(), rotaId, b]);
    });
    // Associar os motoristas para as rotas já ativas
    run("INSERT INTO vendedor_rotas(vendedor_id, rota_config_id, dia_semana) VALUES(?, ?, ?)", [uMotoristas[index], rotaId, (index % 6) + 1]);
  });

  console.log('4. Criando Produtos e Estoque...');
  const catId = id();
  run("INSERT INTO categorias(id, nome, slug) VALUES(?, 'Distribuição', 'dist')", [catId]);
  const produtos = [];
  for(let i=1; i<=150; i++) {
    const pid = id();
    const preco = parseFloat((Math.random() * 50 + 10).toFixed(2));
    run("INSERT INTO produtos(id, nome, sku, preco_base, categoria_id) VALUES(?, ?, ?, ?, ?)", [pid, `Produto Padrão ${i}`, `PRD-${i}`, preco, catId]);
    run("INSERT INTO estoque(produto_id, quantidade_disponivel) VALUES(?, ?)", [pid, 1000]);
    produtos.push({id: pid, preco});
  }

  console.log('5. Criando Clientes reais de GV...');
  const clientesNormais = [];
  const clientesWeb = [];

  // Vendedores com dezenas de clientes cada (total 300 clientes)
  uVendedores.forEach((vendId, vIdx) => {
    for(let c=1; c<=30; c++) {
      const cid = id();
      const bairro = bairros[Math.floor(Math.random() * bairros.length)];
      run(
        "INSERT INTO clientes(id, razao_social, cnpj_cpf, endereco, bairro, cidade, estado, vendedor_id) VALUES(?, ?, ?, ?, ?, 'Governador Valadares', 'MG', ?)",
        [cid, `Mercearia Bairro ${bairro} - ${vIdx}-${c}`, `00.000.000/0001-${String(vIdx)}${String(c).padStart(2,'0')}`, `Av Principal, ${c*10}`, bairro, vendId]
      );
      clientesNormais.push(cid);
    }
  });

  // Clientes WEB (50 clientes)
  for(let i=1; i<=50; i++) {
    const uid = id();
    run("INSERT INTO usuarios(id, nome, email, senha_hash, role) VALUES(?, ?, ?, ?, 'web_client')", [uid, `Cliente Web ${i}`, `web${i}@gv.local`, defaultPassword]);
    uWeb.push(uid);

    const cid = id();
    const bairro = bairros[Math.floor(Math.random() * bairros.length)];
    run(
      "INSERT INTO clientes(id, razao_social, cnpj_cpf, endereco, bairro, cidade, estado, vendedor_id) VALUES(?, ?, ?, ?, ?, 'Governador Valadares', 'MG', NULL)",
      [cid, `Loja Online ${bairro} ${i}`, `11.111.111/0001-${String(i).padStart(2,'0')}`, `Rua Web, ${i}`, bairro]
    );
    run("INSERT INTO usuario_clientes(usuario_id, cliente_id) VALUES(?, ?)", [uid, cid]);
    clientesWeb.push(cid);
  }

  console.log('6. Gerando Pedidos (Foco em Separação e Rotas)...');
  
  // Função para criar pedidos
  const criarPedido = (origem, operador, cliente, status) => {
    const pedidoId = id();
    const dataIso = new Date().toISOString();
    
    // Insere o pedido com total 0 (será atualizado)
    run(
      "INSERT INTO pedidos(id, numero, cliente_id, operador_id, origem, status, total, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, 0, ?, ?)",
      [pedidoId, `PED-${pedidoId.slice(0,6).toUpperCase()}`, cliente, operador, origem, status, dataIso, dataIso]
    );

    let total = 0;
    const qtdItens = Math.floor(Math.random() * 4) + 1;
    for(let k=0; k<qtdItens; k++) {
      const p = produtos[Math.floor(Math.random() * produtos.length)];
      const qtd = Math.floor(Math.random() * 5) + 1;
      const sub = p.preco * qtd;
      total += sub;
      run(
        "INSERT INTO pedido_itens(id, pedido_id, produto_id, quantidade, preco_unitario_aplicado, subtotal) VALUES(?, ?, ?, ?, ?, ?)",
        [id(), pedidoId, p.id, qtd, p.preco, sub]
      );
      run("UPDATE estoque SET quantidade_disponivel = quantidade_disponivel - ? WHERE produto_id = ?", [qtd, p.id]);
    }
    run("UPDATE pedidos SET total = ? WHERE id = ?", [total, pedidoId]);
    return pedidoId;
  };

  const rotasDesignadas = {
    0: [], 1: [], 2: [], 3: [], 4: [], 5: []
  };

  // Gerar pedidos VENDEDORES (300 pedidos, maioria separacao/rota)
  for(let i=0; i<300; i++) {
    const cliente = clientesNormais[i % clientesNormais.length];
    const row = all("SELECT vendedor_id FROM clientes WHERE id=?", [cliente])[0];
    const status = (i < 150) ? 'SEPARACAO' : (i < 250 ? 'ROTA' : 'PENDENTE');
    const pid = criarPedido('VENDEDOR', row.vendedor_id, cliente, status);
    
    if(status === 'ROTA') rotasDesignadas[i % 6].push(pid);
  }

  // Gerar pedidos PDVs / CAIXAS (4 PDVs com dezenas de operações) -> total 120
  for(let i=0; i<120; i++) {
    const caixa = uCaixas[i % uCaixas.length];
    criarPedido('BALCAO', caixa, 'CLIENTE-BALCAO', 'CONCLUIDO');
  }

  // Gerar pedidos WEB (100 pedidos)
  for(let i=0; i<100; i++) {
    const cliente = clientesWeb[i % clientesWeb.length];
    // Muitos em separação
    const status = (i < 60) ? 'SEPARACAO' : 'PENDENTE';
    criarPedido('WEB', null, cliente, status);
  }

  console.log('7. Montando as Rotas com os Motoristas...');
  
  // Para os pedidos que estão em ROTA, vamos criar de fato as rotas_logistica!
  Object.keys(rotasDesignadas).forEach(rotaIdx => {
    const pids = rotasDesignadas[rotaIdx];
    if(pids.length === 0) return;
    
    const driver = uMotoristas[rotaIdx];
    const logisticaId = id();
    const dataHoje = new Date().toISOString().split('T')[0];
    
    run(
      "INSERT INTO rotas_logistica(id, motorista_id, data, status) VALUES(?, ?, ?, 'EM_ANDAMENTO')",
      [logisticaId, driver, dataHoje]
    );

    pids.forEach((pid, ordem) => {
      run("INSERT INTO rota_pedidos(rota_id, pedido_id, ordem) VALUES(?, ?, ?)", [logisticaId, pid, ordem + 1]);
    });
  });

  console.log('Finalizado com sucesso.');
});
