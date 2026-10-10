import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {readSave,atomicWrite} from '../grand-release-001/persistence.mjs';
// Runs before the new server admits connections. Render's single-instance disk
// deployment must first shut down the old writer. Originals are never rewritten.
export function backupBeforeRelease(root,checkpoint='before-release002'){
 if(!/^before-[a-z0-9-]+$/.test(checkpoint))throw Error('INVALID_BACKUP_LABEL');
 if(!fs.existsSync(root))return;
 const dest=path.join(root,checkpoint),manifestFile=path.join(dest,'manifest.json');
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 if(fs.existsSync(manifestFile)){
  const manifest=JSON.parse(fs.readFileSync(manifestFile));
  for(const row of manifest.files)if(hash(fs.readFileSync(path.join(dest,row.path)))!==row.sha256)throw Error('RELEASE_BACKUP_CHECKSUM_FAILED');
  return;
 }
 const files=[],collect=relative=>{const file=path.join(root,relative);if(!fs.existsSync(file))return;if(fs.lstatSync(file).isSymbolicLink())throw Error('RELEASE_BACKUP_SYMLINK_DENIED');if(relative.endsWith('campaign.json'))readSave(file);files.push({path:relative,bytes:fs.readFileSync(file)});};
 collect('visitor-key');const visitors=path.join(root,'visitors');
 if(fs.existsSync(visitors))for(const id of fs.readdirSync(visitors).filter(id=>/^[a-f0-9]{64}$/.test(id))){
  collect('visitors/'+id+'/visitor.json');collect('visitors/'+id+'/campaign.json');collect('visitors/'+id+'/division-002/campaign.json');collect('visitors/'+id+'/division-003/campaign.json');
 }
 const required=files.reduce((n,f)=>n+f.bytes.length,0),disk=fs.statfsSync(root);if(disk.bavail*disk.bsize<required+16*1024*1024)throw Error('RELEASE_BACKUP_DISK_SPACE_INSUFFICIENT');
 for(const f of files)atomicWrite(path.join(dest,f.path),f.bytes);
 atomicWrite(manifestFile,JSON.stringify({version:1,createdAt:new Date().toISOString(),files:files.map(f=>({path:f.path,bytes:f.bytes.length,sha256:hash(f.bytes)}))},null,2));
}
