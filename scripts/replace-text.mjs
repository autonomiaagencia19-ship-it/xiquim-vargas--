import fs from 'fs';

let content = fs.readFileSync('src/pdf.js', 'utf8');

const regex = /DISTRIBUIÇÃO DE BEBIDAS/g;
if (regex.test(content)) {
  content = content.replace(regex, 'DISTRIBUIDORA');
  fs.writeFileSync('src/pdf.js', content);
  console.log('Replaced successfully!');
} else {
  console.log('Not found in UTF-8 string.');
}
