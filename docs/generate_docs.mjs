import fs from 'fs';
import path from 'path';

// Lendo o logo (foi gravado em UTF-16LE pelo PowerShell Out-File)
const logoBase64 = fs.readFileSync('docs/assets/logo_base64.txt', 'utf16le').replace(/[\r\n]/g, '');

const header = `<html><head><meta charset='utf-8'><style>
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 40px; color: #333; }
h1 { color: #1a5276; border-bottom: 2px solid #1a5276; padding-bottom: 5px; }
h2 { color: #2980b9; margin-top: 30px; }
h3 { color: #2471a3; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #bdc3c7; padding: 10px; text-align: left; }
th { background-color: #ebedef; }
.logo { text-align: center; margin-bottom: 30px; }
.logo img { max-height: 120px; }
blockquote { background: #f9f9f9; border-left: 5px solid #ccc; margin: 1.5em 10px; padding: 0.5em 10px; }
</style></head><body>
<div class='logo'><img src='data:image/png;base64,${logoBase64}' /></div>
`;
const footer = `</body></html>`;

function mdToHtml(md) {
  let html = md;
  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  // Convert italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  // Convert inline code
  html = html.replace(/`(.*?)`/gim, '<code>$1</code>');
  // Convert lists
  html = html.replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/^1\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/^2\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/^3\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/^4\. (.*$)/gim, '<ol><li>$1</li></ol>');
  html = html.replace(/^5\. (.*$)/gim, '<ol><li>$1</li></ol>');
  // Cleanup adjacent lists
  html = html.replace(/<\/ul>\n<ul>/gim, '\n');
  html = html.replace(/<\/ol>\n<ol>/gim, '\n');
  // Convert blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  // Paragraphs
  html = html.split('\n').map(line => {
    if(line.trim() === '' || line.startsWith('<h') || line.startsWith('<u') || line.startsWith('<o') || line.startsWith('<li') || line.startsWith('<block') || line.startsWith('---') || line.startsWith('|') || line.startsWith('```')) return line;
    return '<p>' + line + '</p>';
  }).join('\n');
  // Clean up HR
  html = html.replace(/^---/gim, '<hr>');
  return html;
}

['Handoff_Engenharia_ERP_APKs_Xiquim_Vargas_1.8.1', 'Manual_de_Uso_ERP_Xiquim_Vargas_1.8.1', 'Runbook_Operacional_Xiquim_Vargas_ERP_1.8.1'].forEach(name => {
  const md = fs.readFileSync(\`docs/\${name}.md\`, 'utf8');
  // Limpar blocos mermaid para não quebrar a view no Word
  const cleanMd = md.replace(/\`\`\`mermaid[\\s\\S]*?\`\`\`/g, '[Diagrama Omitido na Versão Texto. Abra o arquivo .md para ver os fluxogramas]');
  const finalHtml = header + mdToHtml(cleanMd) + footer;
  fs.writeFileSync(\`docs/\${name}_Autonomia.doc\`, finalHtml, 'utf8');
});
console.log("Arquivos .doc gerados com sucesso!");
