import fs from 'node:fs';
import path from 'node:path';

const renDir = path.resolve('xiquim_imagens_renomeadas');
const files = fs.readdirSync(renDir).filter(f => f.toLowerCase().endsWith('.jpg'));

console.log('Total jpg files in xiquim_imagens_renomeadas:', files.length);

// Let's create an intelligent group mapping
const groups = new Map();

for (const f of files) {
  let base = f.replace(/\.jpg$/i, '').trim();
  // normalize whitespace
  base = base.replace(/\s+/g, ' ');
  
  // check for suffixes like " (2)", " (3)", " (1)", " 1", " 2", " 3", " 4"
  // but be careful with "2L", "500g", "1L", etc.
  let isSecondary = false;
  let canonicalName = base;
  
  const parenMatch = base.match(/^(.+?)\s*\(([0-9]+)\)$/);
  if (parenMatch) {
    canonicalName = parenMatch[1].trim();
    isSecondary = true;
  } else {
    const numEndMatch = base.match(/^(.+?)\s+([1-4])$/);
    if (numEndMatch) {
      // Check if there is another file with this prefix or if it's a series
      const prefix = numEndMatch[1].trim();
      canonicalName = prefix;
      isSecondary = (numEndMatch[2] !== '1');
    }
  }
  
  if (!groups.has(canonicalName)) {
    groups.set(canonicalName, []);
  }
  groups.get(canonicalName).push({
    fileName: f,
    originalName: base,
    isSecondary
  });
}

console.log('Total canonical products:', groups.size);

const multiList = [];
for (const [name, list] of groups.entries()) {
  if (list.length > 1) {
    multiList.push({ name, files: list.map(x => x.fileName) });
  }
}

console.log('Products with multiple images:', multiList.length);
multiList.forEach(m => console.log(`- ${m.name}: ${m.files.join(' | ')}`));
