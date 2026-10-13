export function assertString(v,name,{max=255,min=1}={}){if(typeof v!=='string'||v.trim().length<min||v.length>max)throw Object.assign(new Error(`${name} inválido`),{status:400});return v.trim()}
export function assertInt(v,name,{min=0,max=1000000000}={}){const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Object.assign(new Error(`${name} inválido`),{status:400});return n}
export function assertMoney(v,name='Valor'){const n=Number(v);if(!Number.isFinite(n)||n<0||n>1000000000)throw Object.assign(new Error(`${name} inválido`),{status:400});return Math.round(n*100)/100}
export function assertEmail(v,name='E-mail'){const x=assertString(String(v??''),name,{max:254});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))throw Object.assign(new Error(`${name} inválido`),{status:400});return x.toLowerCase()}
export function assertEnum(v,name,allowed){if(!allowed.includes(v))throw Object.assign(new Error(`${name} inválido`),{status:400});return v}
export function assertCoordinate(v,name){const n=Number(v);if(!Number.isFinite(n)||n < -180 || n > 180)throw Object.assign(new Error(`${name} inválida`),{status:400});return n}
export function slugify(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120)}
