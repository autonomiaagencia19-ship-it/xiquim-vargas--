import fs from 'fs';

let serverCode = fs.readFileSync('server.js', 'utf8');

serverCode = serverCode.replace(
  /SELECT p\.\*, c\.nome as cliente_nome, c\.nome_fantasia, c\.cnpj_cpf/,
  "SELECT p.*, c.razao_social as cliente_nome, c.nome_fantasia, c.cnpj_cpf"
);

fs.writeFileSync('server.js', serverCode);
console.log('Fixed SQL query column in server.js');
