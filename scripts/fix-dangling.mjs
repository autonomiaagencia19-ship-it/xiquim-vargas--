import fs from 'fs';

let serverCode = fs.readFileSync('server.js', 'utf8');

// The problematic section looks exactly like this:
/*
    } catch(e) {
      return send(res, 500, {error: e.message});
    }
  }
    });
  }

return send(res,404,{error:"Rota não encontrada"});
*/

serverCode = serverCode.replace(
  /    } catch\(e\) \{\n      return send\(res, 500, \{error: e\.message\}\);\n    \}\n  \}\n    \}\);\n  \}\n\nreturn send\(res,404,\{error:"Rota não encontrada"\}\);/,
  `    } catch(e) {
      return send(res, 500, {error: e.message});
    }
  }
return send(res,404,{error:"Rota não encontrada"});`
);

fs.writeFileSync('server.js', serverCode);
console.log('Fixed dangling brackets');
