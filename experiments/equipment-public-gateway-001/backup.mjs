import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {directories,files,validateStorage} from './storage.mjs';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
export function verify(backup){
 const m=JSON.parse(fs.readFileSync(path.join(backup,'manifest.json')));
 if(m.schema!=='EQUIPMENT-GATEWAY-BACKUP-1')throw Error('BACKUP_VERSION_INVALID');
 const expected=new Set();for(const row of m.files){if(!/^(legacy|rooms)\//.test(row.path)||row.path.split('/').includes('..')||row.path.includes('\\')||expected.has(row.path))throw Error('BACKUP_PATH_INVALID');expected.add(row.path);const f=path.join(backup,...row.path.split('/'));if(hash(f)!==row.sha256)throw Error('BACKUP_HASH_MISMATCH');}
 for(const group of ['legacy','rooms']){for(const f of files(path.join(backup,group))){if(!expected.has(path.relative(backup,f).replaceAll('\\','/')))throw Error('BACKUP_UNLISTED_FILE');}if(!expected.has(group+'/visitor-key'))throw Error('BACKUP_KEY_MISSING');}
 validateStorage(directories(path.join(backup,'legacy'),path.join(backup,'rooms')));return m;
}
export function backup(legacy,rooms,destination){
 const d=directories(legacy,rooms);validateStorage(d);
 for(const p of Object.values(d))if(fs.existsSync(path.join(p,'.gateway-lock')))throw Error('OFFLINE_BACKUP_REQUIRED');
 if(!path.isAbsolute(destination)||fs.existsSync(destination))throw Error('NEW_ABSOLUTE_BACKUP_DIRECTORY_REQUIRED');
 const parent=fs.realpathSync(path.dirname(destination)),target=path.join(parent,path.basename(destination));
 for(const p of Object.values(d))if(target===p||target.startsWith(p+path.sep)||p.startsWith(target+path.sep))throw Error('BACKUP_SOURCE_OVERLAP');
 fs.mkdirSync(target);const m={schema:'EQUIPMENT-GATEWAY-BACKUP-1',createdAt:new Date().toISOString(),files:[]};
 for(const [group,p]of Object.entries(d)){fs.mkdirSync(path.join(target,group));for(const f of files(p)){const rel=path.relative(p,f),to=path.join(target,group,rel);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(f,to,fs.constants.COPYFILE_EXCL);fs.chmodSync(to,0o600);const sha256=hash(f);if(hash(to)!==sha256)throw Error('BACKUP_COPY_MISMATCH');m.files.push({path:group+'/'+rel.replaceAll('\\','/'),sha256});}}
 fs.writeFileSync(path.join(target,'manifest.json'),JSON.stringify(m,null,2),{flag:'wx',mode:0o600});verify(target);return {files:m.files.length,verified:true};
}
export function restore(backupDir,legacy,rooms){
 verify(backupDir);const d=directories(legacy,rooms);for(const p of Object.values(d))if(fs.readdirSync(p).length)throw Error('RESTORE_REQUIRES_EMPTY_DIRECTORIES');
 for(const [group,to]of Object.entries(d))fs.cpSync(path.join(backupDir,group),to,{recursive:true,errorOnExist:true,force:false});
 const m=verify(backupDir);for(const row of m.files){const[group,...rest]=row.path.split('/');if(hash(path.join(d[group],...rest))!==row.sha256)throw Error('RESTORE_HASH_MISMATCH');}validateStorage(d);return {verified:true,files:m.files.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,a,b,c]=process.argv.slice(2);const result=mode==='create'?backup(a,b,c):mode==='verify'?{verified:!!verify(a)}:mode==='restore'?restore(a,b,c):(()=>{throw Error('USAGE: create LEGACY_DIR MP_DIR NEW_BACKUP | verify BACKUP | restore BACKUP EMPTY_LEGACY EMPTY_MP');})();console.log(JSON.stringify(result));
}
