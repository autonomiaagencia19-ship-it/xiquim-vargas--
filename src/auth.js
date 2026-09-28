import crypto from 'node:crypto';
const SECRET=process.env.JWT_SECRET||'dev-xiquim-vargas-change-me';
if(process.env.NODE_ENV==='production' && SECRET==='dev-xiquim-vargas-change-me') throw new Error('JWT_SECRET inseguro em produção');
const b64=o=>Buffer.from(o).toString('base64url');
export function hashPassword(password){const salt=crypto.randomBytes(16);const hash=crypto.scryptSync(password,salt,64);return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`}
export function verifyPassword(password,stored){const [,s,h]=stored.split('$');if(!s||!h)return false;const got=crypto.scryptSync(password,Buffer.from(s,'base64url'),64);return crypto.timingSafeEqual(got,Buffer.from(h,'base64url'))}
export function sign(payload,ttl=86400){const header=b64(JSON.stringify({alg:'HS256',typ:'JWT'}));const body=b64(JSON.stringify({...payload,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+ttl}));const sig=crypto.createHmac('sha256',SECRET).update(`${header}.${body}`).digest('base64url');return `${header}.${body}.${sig}`}
export function verify(token){const [h,b,s]=String(token||'').split('.');if(!h||!b||!s||h.length>100||b.length>10000||s.length>100)throw new Error('token');const sig=crypto.createHmac('sha256',SECRET).update(`${h}.${b}`).digest('base64url');const a=Buffer.from(sig),bb=Buffer.from(s);if(a.length!==bb.length||!crypto.timingSafeEqual(a,bb))throw new Error('signature');const p=JSON.parse(Buffer.from(b,'base64url'));if(p.exp<Date.now()/1000)throw new Error('expired');return p}
export function bearer(req){const x=req.headers.authorization||'';return x.startsWith('Bearer ')?x.slice(7):null}
export function auth(req){const t=bearer(req);if(!t)throw Object.assign(new Error('Autenticação necessária'),{status:401});try{return verify(t)}catch{throw Object.assign(new Error('Sessão inválida ou expirada'),{status:401})}}
export function requireRole(req,roles){const u=auth(req);if(!roles.includes(u.role))throw Object.assign(new Error('Acesso negado'),{status:403});return u}
