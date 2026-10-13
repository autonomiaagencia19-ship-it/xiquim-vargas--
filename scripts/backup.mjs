import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {db,STORAGE} from '../src/db.js';

const ROOT=path.resolve(process.cwd());
const BACKUPS=path.join(STORAGE,'backups');
const day=new Date().toISOString().slice(0,10);
const target=path.join(BACKUPS,day);
const temp=path.join(BACKUPS,`.tmp-${day}-${crypto.randomUUID()}`);
fs.mkdirSync(BACKUPS,{recursive:true});
for(const entry of fs.readdirSync(BACKUPS,{withFileTypes:true}))if(entry.isDirectory()&&entry.name.startsWith('.tmp-'))fs.rmSync(path.join(BACKUPS,entry.name),{recursive:true,force:true});
const force=process.argv.includes('--force');
if(fs.existsSync(target)&&!force){console.log(JSON.stringify({ok:true,skipped:true,backup:day}));process.exit(0)}
fs.mkdirSync(temp,{recursive:true});
try{
 const database=path.join(temp,'xiquim-vargas.db');
 db.exec(`VACUUM INTO '${database.replaceAll("'","''")}'`);
 const check=new (db.constructor)(database);
 try{const result=check.prepare('PRAGMA integrity_check').get().integrity_check;if(result!=='ok')throw new Error(`integrity_check: ${result}`)}finally{check.close()}
 for(const name of ['product-images','store-cover','proofs','pdfs']){
  const source=path.join(STORAGE,name),destination=path.join(temp,name);
  if(fs.existsSync(source))fs.cpSync(source,destination,{recursive:true,errorOnExist:true});
 }
 const files=[];
 const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile())files.push(full)}};
 walk(temp);files.sort();
 const digest=async file=>await new Promise((resolve,reject)=>{const hash=crypto.createHash('sha256');const input=fs.createReadStream(file);input.on('error',reject);input.on('data',chunk=>hash.update(chunk));input.on('end',()=>resolve(hash.digest('hex')))});
 const lines=[];for(const file of files)lines.push(`${await digest(file)}  ${path.relative(temp,file).split(path.sep).join('/')}`);
 const manifest=lines.join('\n')+'\n';
 fs.writeFileSync(path.join(temp,'manifest.sha256'),manifest,{encoding:'utf8',mode:0o600});
 const bytes=files.reduce((n,file)=>n+fs.statSync(file).size,0);
 if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
 fs.renameSync(temp,target);
 const snapshots=fs.readdirSync(BACKUPS,{withFileTypes:true}).filter(x=>x.isDirectory()&&/^\d{4}-\d{2}-\d{2}$/.test(x.name)).map(x=>x.name).sort().reverse();
 for(const old of snapshots.slice(7)){const candidate=path.resolve(BACKUPS,old);if(path.dirname(candidate)===path.resolve(BACKUPS)&&candidate!==target)fs.rmSync(candidate,{recursive:true,force:true})}
 console.log(JSON.stringify({ok:true,backup:day,files:files.length+1,bytes}));
}catch(error){if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:true});console.error(JSON.stringify({ok:false,backup:day,error:error.message}));process.exitCode=1}
