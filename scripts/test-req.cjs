const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/logistics/loading-list/orders-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(JSON.stringify({ pedido_ids: ["123"] }));
req.end();
