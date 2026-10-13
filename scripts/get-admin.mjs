import { all } from '../src/db.js';
const admins = all("SELECT email, nome FROM usuarios WHERE role = 'admin'");
console.log(JSON.stringify(admins, null, 2));
