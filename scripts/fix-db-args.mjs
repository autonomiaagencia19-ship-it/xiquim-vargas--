import fs from 'fs';

let serverCode = fs.readFileSync('server.js', 'utf8');

// The problematic code uses `...ids`
const badCodeRegex = /const orders = all\(\`[\s\S]*?\`,\s*\.\.\.ids\);[\s\S]*?const items = all\(\`[\s\S]*?\`,\s*\.\.\.ids\);/m;

if (badCodeRegex.test(serverCode)) {
  serverCode = serverCode.replace(
    /const orders = all\(\`([\s\S]*?)\`,\s*\.\.\.ids\);/,
    "const orders = all(`$1`, ids);"
  );
  serverCode = serverCode.replace(
    /const items = all\(\`([\s\S]*?)\`,\s*\.\.\.ids\);/,
    "const items = all(`$1`, ids);"
  );
  
  // also update the catch block to return the stack trace so we don't have to guess next time
  serverCode = serverCode.replace(
    /return send\(res, 500, \{error: e\.message\}\);/,
    "return send(res, 500, {error: e.stack});"
  );
  
  fs.writeFileSync('server.js', serverCode);
  console.log('Fixed ...ids to ids in server.js');
} else {
  console.log('Regex did not match. Let me check the actual code.');
  const lines = serverCode.split('\\n');
  const idx = lines.findIndex(l => l.includes('orders-pdf'));
  console.log(lines.slice(idx, idx + 35).join('\\n'));
}
