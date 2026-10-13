import fs from 'fs';
let c = fs.readFileSync('public/app.js', 'utf8');
if (!c.includes('removeRouteAssignment')) {
  c += `\nasync function removeRouteAssignment(vid, dia){if(!confirm('Remover designação de rota deste vendedor neste dia?'))return;try{await api('/api/logistics/route-assignments/'+vid+'/'+dia,{method:'DELETE'});toast('Designação removida');show('logistics')}catch(e){toast(e.message)}}`;
  fs.writeFileSync('public/app.js', c);
  console.log('Added removeRouteAssignment');
}
