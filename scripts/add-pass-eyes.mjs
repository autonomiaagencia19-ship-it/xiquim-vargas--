import fs from 'fs';

function addEye(file) {
  let content = fs.readFileSync(file, 'utf8');
  let updated = false;

  // We find <input ... type="password" ...>
  // But wait, what if it's already wrapped in <div style="display:flex;gap:6px">?
  // We should be careful to only replace inputs that are not already followed by <button...👁</button>
  
  content = content.replace(/<input([^>]+type="password"[^>]*)>/g, (match, inner) => {
    // If it already has style="flex:1" we skip it because it's already wrapped
    if (inner.includes('flex:1')) return match;
    
    // Add style="flex:1" to the input
    const newInner = inner + ' style="flex:1"';
    return `<div style="display:flex;gap:6px"><input${newInner}><button type="button" class="btn" tabindex="-1" onclick="const x=this.previousElementSibling; x.type=x.type==='password'?'text':'password'">👁</button></div>`;
  });

  if (content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}

addEye('public/app.js');
addEye('public/role.js');
