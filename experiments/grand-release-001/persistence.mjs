import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
import {Campaign} from './territory.mjs';
import {canonical} from '../grand-play-mp022/sync.mjs';
export const SAVE_SCHEMA='GRAND-RELEASE-TERRITORY-1';
const hash=x=>createHash('sha256').update(canonical(x)).digest('hex');
export function atomicWrite(file,bytes){
 fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';const fd=fs.openSync(tmp,'w',0o600);
 try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(tmp,file);
 if(process.platform!=='win32'){const dir=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}}
}
// Disk waits yield to sockets and local HTTP proxy; snapshot and ledger are still
// captured under the authority queue, and acknowledgement follows durable fsync.
async function atomicWriteAsync(file,bytes){
 await fsp.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp',fd=await fsp.open(tmp,'w',0o600);
 try{await fd.writeFile(bytes);await fd.sync();}finally{await fd.close();}
 await fsp.rename(tmp,file);
 if(process.platform!=='win32'){const dir=await fsp.open(path.dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}
}
export function readSave(file){const e=JSON.parse(fs.readFileSync(file,'utf8'));if(hash(e.payload)!==e.checksum)throw Error('SAVE_CHECKSUM_FAILED');const s=JSON.parse(e.payload);if(s.schema!==SAVE_SCHEMA||s.rules!=='GRAND-TERRITORY-1'||!s.transport?.next)throw Error('UNSUPPORTED_SAVE_VERSION');return s;}
export class ReleaseAdapter extends CampaignAdapter{
 constructor(options={}){super({...options,restore:false,CampaignClass:options.CampaignClass??Campaign});this.receiptLimit=Infinity;this.releaseClass=options.CampaignClass??Campaign;this.persistence={state:'unsaved',savedAt:null,tick:null,error:null,intervalSeconds:30};this.lastSaveAt=0;this.savedRevision=-1;if(this.saveFile&&fs.existsSync(this.saveFile))this.loadFile();}
 async saveFileNow(){
  if(!this.saveFile)throw Error('SAVE_UNAVAILABLE');
  try{const savedAt=new Date().toISOString(),payload=JSON.stringify({schema:SAVE_SCHEMA,rules:'GRAND-TERRITORY-1',savedAt,campaign:this.c.save(),transport:this.c.transport});
   // Keep the last verified checkpoint; never rotate a corrupt current file over it.
   if(fs.existsSync(this.saveFile)){const previous=await fsp.readFile(this.saveFile,'utf8');if(previous!==this.verifiedSave){readSave(this.saveFile);this.verifiedSave=previous;}await atomicWriteAsync(this.saveFile+'.bak',previous);}
   const bytes=JSON.stringify({checksum:hash(payload),payload});await atomicWriteAsync(this.saveFile,bytes);this.verifiedSave=bytes;
   this.savedRevision=this.c.version;this.lastSaveAt=Date.now();this.persistence={...this.persistence,state:'saved',savedAt,tick:this.c.clock.tick,error:null};
  }catch(e){this.c.clock.paused=true;this.c.version++;this.persistence={...this.persistence,state:'failed',error:'保存失败，世界已暂停；请检查磁盘后重试。'};throw e;}
 }
 loadFile(){
  const s=readSave(this.saveFile),old=this.c.clock,revision=this.c.version;this.c.restore(s.campaign);this.c.transport=structuredClone(s.transport);
  this.c.version=Math.max(revision,this.c.version)+1;this.c.match.matchRevision=this.c.version;
  for(const g of this.c.clock.corps)g.commandGeneration=Math.max(g.commandGeneration??0,old.corps.find(x=>x.permanentId===g.permanentId)?.commandGeneration??0)+1;
  for(const[id,u]of Object.entries(this.c.clock.units))u.commandGeneration=Math.max(u.commandGeneration??0,old.units[id]?.commandGeneration??0)+1;
  this.c.transport.worldGeneration++;this.c.transport.economyGeneration++;this.era=randomUUID();this.accumulated=0;this.c.clock.paused=true;
  this.persistence={state:'saved',savedAt:s.savedAt,tick:s.campaign.clock.tick,error:null,intervalSeconds:30};this.lastSaveAt=Date.now();this.savedRevision=this.c.version;
 }
 async view(seat){const v=await super.view(seat);v.document.release={version:'GRAND-RELEASE-001',persistence:{...this.persistence},runtime:this.runtime?{...this.runtime}:null,offlinePolicy:'全部操作端断线后立即暂停；重连不会自动继续。'};return v;}
 async submit(seat,e){const result=await super.submit(seat,e);if(e.kind!=='SAVE'&&result.status==='APPLIED'&&this.savedRevision!==this.c.version)await this.exclusive(async()=>{try{await this.saveFileNow();}catch{/* Applied business action is not rolled back; visible save failure pauses world. */}});return result;}
 async autoSave(){return this.exclusive(async()=>{if((Date.now()-this.lastSaveAt>=30000||this.c.clock.tick-(this.persistence.tick??0)>=12)&&this.savedRevision!==this.c.version){try{await this.saveFileNow();}catch{}}});}
 async offline(){return this.exclusive(async()=>{if(!this.c.clock.paused){this.c.clock.paused=true;this.c.version++;this.c.transport.worldGeneration++;}try{if(this.savedRevision!==this.c.version)await this.saveFileNow();}catch{}});}
 async newGame(expected){return this.exclusive(async()=>{if(expected.instanceId!==this.id||expected.revision!==this.revision)throw Error('战役状态已变化，请刷新入口后重新确认。');await this.saveFileNow();await atomicWriteAsync(this.saveFile+'.before-new',await fsp.readFile(this.saveFile));
  const fresh=new CampaignAdapter({CampaignClass:this.releaseClass.newCampaignClass??Campaign});this.c=fresh.c;this.era=randomUUID();this.accumulated=0;this.c.clock.paused=true;await this.saveFileNow();return {ok:true};});}
}
