import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {STORAGE, one} from './db.js';

const TOKEN_FILE=path.join(STORAGE,'setup-token.txt');
function adminExists(){return Number(one("SELECT COUNT(*) n FROM usuarios WHERE role='admin' AND ativo=1")?.n||0)>0}
function ensureToken(){
  if(adminExists()) return null;
  if(!fs.existsSync(TOKEN_FILE)){
    const token=crypto.randomBytes(24).toString('base64url');
    fs.writeFileSync(TOKEN_FILE,token,{mode:0o600});
    console.log(`FIRST ACCESS: configuração inicial disponível somente com o token exibido abaixo.`);
    console.log(`FIRST ACCESS TOKEN: ${token}`);
    console.log(`FIRST ACCESS URL: /admin.html?setup=${token}`);
  }
  return fs.readFileSync(TOKEN_FILE,'utf8').trim();
}
export function getSetupStatus(req){
  const required=!adminExists();
  const token=required?ensureToken():null;
  if(required) console.log(`FIRST ACCESS URL: ${setupUrl(req)}`);
  return {required,token};
}
export function httpBaseUrl(req){
  const configured=String(process.env.PUBLIC_BASE_URL||'').trim();
  const configuredMatch=configured.match(/^([a-z][a-z0-9+.-]*):\/\/(.+)$/i);
  const host=configuredMatch?configuredMatch[2]:String(req?.headers?.host||'localhost');
  const forwarded=String(req?.headers?.['x-forwarded-proto']||'').split(',')[0].trim().toLowerCase();
  const protocol=configuredMatch?.[1]||(process.env.NODE_ENV==='production'||forwarded==='https'?'https':'http');
  return `${protocol}://${host}`.replace(/\/+$/,'');
}
export function setupUrl(req){
  const token=ensureToken();
  return `${httpBaseUrl(req)}/admin?setup=${encodeURIComponent(token||'')}`;
}
export function consumeSetupToken(candidate){
  const expected=ensureToken();
  if(!expected||!candidate)return false;
  const a=Buffer.from(expected);const b=Buffer.from(String(candidate));
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  try{fs.unlinkSync(TOKEN_FILE)}catch{}
  return true;
}
