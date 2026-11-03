import http from 'node:http';
import { server } from '../server.js';

let port;
let baseUrl;

async function start() {
  if (server.listening) {
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  } else {
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }
}

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || body
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- INICIANDO TESTES NATIVOS DE SEGURANÇA E REGRESSÃO ---');
  await start();
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`✗ [FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  // 1. Health & Setup Check
  await test('GET /health retorna 200 OK com uptime e status SQLite', async () => {
    const res = await request('/health');
    if (res.status !== 200) throw new Error(`Esperado 200, recebido ${res.status}`);
    if (res.body.uptime_seconds === undefined) throw new Error('Campo uptime_seconds ausente');
  });

  // 2. Hardening Login Backdoor Check
  await test('POST /api/auth/login rejeita senha arbitrária sem credenciais válidas', async () => {
    const res = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { email: 'inexistente@xiquim.local', password: '123456' }
    });
    if (res.status !== 401) throw new Error(`Esperado 401, recebido ${res.status}`);
  });

  // 3. Media Store Assets Check (Fix da Rota 404)
  await test('GET /media/store-assets/ não quebra com 500 para arquivo inexistente (retorna 404 limpo)', async () => {
    const res = await request('/media/store-assets/card-inexistente.jpg');
    if (res.status !== 404) throw new Error(`Esperado 404, recebido ${res.status}`);
    if (typeof res.body === 'object' && res.body.error !== 'Mídia não encontrada') {
      throw new Error(`Mensagem inesperada: ${JSON.stringify(res.body)}`);
    }
  });

  // 4. Exposição de Stack Trace
  await test('POST /api/logistics/loading-list/orders-pdf rejeita payload vazio sem vazar stack trace', async () => {
    const res = await request('/api/logistics/loading-list/orders-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {}
    });
    const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    if (text.includes('at ModuleLoader') || text.includes('at async ModuleLoader')) {
      throw new Error('Vazamento de stack trace detectado!');
    }
  });

  // Fechamento
  server.close();
  console.log(`\nResultado Final: ${passed} testes aprovados, ${failed} falhas.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Erro fatal na execução:', err);
  process.exit(1);
});
