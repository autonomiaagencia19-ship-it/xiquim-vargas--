import fs from 'fs';
let c = fs.readFileSync('public/app.js', 'utf8');

c = c.replace(
  /<span class="badge">\$\{sg\.total_pedidos\} pedidos · \$\{brl\(sg\.total_valor\)\}<\/span>/g,
  '<span class="badge" style="margin-right:auto; margin-left:10px">${sg.total_pedidos} pedidos · ${brl(sg.total_valor)}</span><label style="cursor:pointer;font-size:12px;display:flex;align-items:center;gap:5px"><input type="checkbox" onchange="const cb=this.closest(\'.logistics-neighborhood\').querySelectorAll(\'.routeOrder\'); cb.forEach(c => c.checked = this.checked)"> Selecionar todos</label>'
);

c = c.replace(
  /<span><strong>\$\{esc\(p\.numero\)\}<\/strong> · \$\{esc\(p\.nome_fantasia\|\|p\.razao_social\)\}<\/span>/g,
  '<span><strong>${esc(p.numero)}</strong> · ${esc(p.nome_fantasia||p.razao_social)} <span class="badge" style="font-size:10px;padding:2px 4px;margin-left:5px">${p.status}</span></span>'
);

c = c.replace(
  /<div class="actions"><button class="btn primary" onclick="assignSellerRoute\(\)">Designar rota<\/button><\/div><\/div><\/div>/g,
  `<div class="actions"><button class="btn primary" onclick="assignSellerRoute()">Designar rota</button></div></div><div class="tablewrap" style="margin-top:15px"><table class="table"><thead><tr><th>Vendedor</th><th>Rota</th><th>Dia</th><th>Ações</th></tr></thead><tbody>\${(u.assignments||[]).map(a=>\`<tr><td>\${esc(a.vendedor_nome)}</td><td>\${esc(a.rota_nome)}</td><td>\${['Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][a.dia_semana-1]}</td><td class="actions"><button class="btn danger" onclick="removeRouteAssignment('\${a.vendedor_id}',\${a.dia_semana})">Remover</button></td></tr>\`).join('')||'<tr><td colspan="4">Nenhuma designação configurada.</td></tr>'}</tbody></table></div></div>`
);

fs.writeFileSync('public/app.js', c);
console.log('app.js modificado com sucesso!');
