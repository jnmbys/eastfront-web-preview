import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicServer} from '../grand-release-tablet/public-server.mjs';
import {Campaign as Legacy} from '../grand-release-001/territory.mjs';
import {Campaign as Division} from '../grand-division-002/authority.mjs';
import {readSave,atomicWrite} from '../grand-release-001/persistence.mjs';
import {backupBeforeRelease} from './backup.mjs';

export const campaignModes=Object.freeze({
 legacy:{CampaignClass:Legacy,directory:'',label:'原战役',description:'继续原有规则与进度，不转换人员、库存或部队。'},
 division:{CampaignClass:Division,directory:'division-002',label:'新编制实验战役（步兵先行）',description:'独立新局：步兵、工兵、骑兵侦察。项目战斗适配，非完整钢四复刻；初始经验0，正常生产与运输补充。'}
});
export async function start(options={}){
 const saveDir=options.saveDir??process.env.SAVE_DIR;
 if(!saveDir)throw Error('PERSISTENT_SAVE_DIR_REQUIRED');
 backupBeforeRelease(saveDir);
 const visitors=path.join(saveDir,'visitors');
 if(fs.existsSync(visitors))for(const id of fs.readdirSync(visitors).filter(id=>/^[a-f0-9]{64}$/.test(id))){
  for(const mode of Object.values(campaignModes)){
   const file=path.join(visitors,id,mode.directory,'campaign.json');
   if(fs.existsSync(file)&&!fs.existsSync(file+'.before-release002')){readSave(file);atomicWrite(file+'.before-release002',fs.readFileSync(file));}
  }
 }
 // Compatibility rollback disables admission to the new engine, never redirects
 // its file into the legacy reader and never deletes its progress.
 const enabled=process.env.RELEASE_DIVISION_ENABLED!=='0';
 return publicServer({...options,saveDir,campaignModes:enabled?campaignModes:{legacy:campaignModes.legacy}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const service=await start();console.log('GRAND-RELEASE-002 dual campaign preview ready');let closing=false;
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await service.close();process.exit(0);});
}
