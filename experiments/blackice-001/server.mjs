import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicServer} from '../grand-release-tablet/public-server.mjs';
import {Campaign} from './authority.mjs';
import {Campaign as R1} from './r1-campaign.mjs';
export async function start(options={}){
 const saveDir=options.saveDir??process.env.SAVE_DIR;if(!saveDir)throw Error('BLACKICE_SEPARATE_SAVE_DIR_REQUIRED');
 return publicServer({...options,saveDir,defaultMode:'blackice-r1',campaignModes:{'blackice-r1':{CampaignClass:R1,directory:'blackice-001-r1',label:'黑冰 R1 · 恢复任务修正',description:'独立新局；自动风险/目标更新不再清空整补任务。伤害、速度与经济参数不变，不导入第一版存档。'},blackice:{CampaignClass:Campaign,directory:'blackice-001',label:'黑冰第一版 · 继续原局',description:'保留LAND-1规则、身份和进度，不自动应用R1。'}}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const service=await start();console.log('BLACKICE local candidate ready');for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();process.exit(0);});}
