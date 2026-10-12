import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {readSave,atomicWrite} from '../grand-release-001/persistence.mjs';
import {Campaign,VERSION} from '../hoi4-equipment-priority-001/authority.mjs';
import {MAP_VERSION} from '../hoi4-equipment-priority-001/geography.mjs';
import {roomCampaign} from '../blackice-mp-001/authority.mjs';
export const ROOM_VERSION='HOI4-EQUIPMENT-PRIORITY-MP-001-1';
export const RoomCampaign=roomCampaign(Campaign,ROOM_VERSION);
export {VERSION,MAP_VERSION};
export function directories(legacy,rooms){
 if(!legacy||!rooms||!path.isAbsolute(legacy)||!path.isAbsolute(rooms))throw Error('EXPLICIT_ABSOLUTE_SAVE_DIRS_REQUIRED');
 const resolve=p=>{if(!fs.existsSync(p)||!fs.statSync(p).isDirectory())throw Error('SAVE_DIRECTORY_UNAVAILABLE');return fs.realpathSync(p);};
 const a=resolve(legacy),b=resolve(rooms),inside=(x,y)=>{const r=path.relative(x,y);return !r||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
 if(inside(a,b)||inside(b,a))throw Error('SAVE_DIRECTORIES_OVERLAP');
 for(const p of [a,b]){const k=path.join(p,'visitor-key');if(fs.existsSync(k)&&fs.readFileSync(k).length!==32)throw Error('INVALID_VISITOR_KEY');}
 if(fs.existsSync(path.join(a,'visitor-key'))&&fs.existsSync(path.join(b,'visitor-key'))&&fs.readFileSync(path.join(a,'visitor-key')).equals(fs.readFileSync(path.join(b,'visitor-key'))))throw Error('VISITOR_KEYS_CONFLICT');
 return {legacy:a,rooms:b};
}
export function files(root){const out=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('SAVE_SYMLINK_DENIED');if(entry.isDirectory())walk(p);else if(entry.isFile())out.push(p);else throw Error('SAVE_SPECIAL_FILE_DENIED');}}walk(root);return out;}
export function validateRoom(s,id,full=false){
 if(s.roomVersion!==ROOM_VERSION||s.clock?.room?.version!==ROOM_VERSION||s.clock?.room?.id!==id||s.clock?.equipmentPriority?.version!==VERSION||s.clock?.regionalMap?.version!==MAP_VERSION)throw Error('ROOM_RULE_OR_MAP_VERSION_MISMATCH');
 const m=s.clock.room.members;if(!m||! /^[a-f0-9]{64}$/.test(m.a)||m.b!==null&&!/^[a-f0-9]{64}$/.test(m.b)||m.a===m.b)throw Error('ROOM_MEMBERS_INVALID');
 if(full){const c=new RoomCampaign();c.restore(s);} // Deep check at admission/startup, not on every authorization lookup.
}
export function validateStorage(d){
 for(const root of Object.values(d))files(root);
 const r=path.join(d.rooms,'rooms');for(const id of fs.existsSync(r)?fs.readdirSync(r):[]){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('ROOM_DIRECTORY_INVALID');validateRoom(readSave(path.join(r,id,'campaign.json')).campaign,id,true);}
 for(const root of Object.values(d)){const key=path.join(root,'visitor-key');if(!fs.existsSync(key)&&files(root).some(f=>!f.endsWith('.gateway-lock')))throw Error('EXISTING_STORAGE_KEY_MISSING');}
}
export function initializeKeys(d){for(const root of Object.values(d)){const k=path.join(root,'visitor-key');if(!fs.existsSync(k))atomicWrite(k,randomBytes(32));}directories(d.legacy,d.rooms);}
export function locks(d){
 const acquired=[];
 const release=()=>{
  const errors=[];
  for(const own of acquired){
   if(own.released)continue;
   try{
    const st=fs.lstatSync(own.file);
    // A replacement, including a symlink, belongs to somebody else.
    if(!st.isFile()||st.dev!==own.dev||st.ino!==own.ino){own.released=true;continue;}
    if(own.written&&fs.readFileSync(own.file,'utf8')!==own.record){own.released=true;continue;}
    fs.unlinkSync(own.file);own.released=true;
   }catch(e){if(e.code==='ENOENT')own.released=true;else errors.push(e);}
  }
  if(errors.length)throw new AggregateError(errors,'SAVE_LOCK_RELEASE_FAILED');
 };
 try{
  for(const dir of Object.values(d)){
   const file=path.join(dir,'.gateway-lock'),fd=fs.openSync(file,'wx',0o600);
   const st=fs.fstatSync(fd),own={file,dev:st.dev,ino:st.ino,record:JSON.stringify({owner:randomUUID(),pid:process.pid,started:new Date().toISOString()}),written:false,released:false};
   acquired.push(own);
   try{fs.writeFileSync(fd,own.record);own.written=true;fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
   const probe=path.join(dir,'.write-probe-'+randomUUID());
   try{atomicWrite(probe,'write-check');}finally{if(fs.existsSync(probe))fs.unlinkSync(probe);}
  }
 }catch(e){
  try{release();}catch(cleanup){throw new AggregateError([e,cleanup],'SAVE_DIRECTORY_LOCK_OR_WRITE_FAILED');}
  throw Error('SAVE_DIRECTORY_LOCK_OR_WRITE_FAILED',{cause:e});
 }
 return release;
}
