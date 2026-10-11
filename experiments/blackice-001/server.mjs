import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicServer} from '../grand-release-tablet/public-server.mjs';
import {Campaign} from './authority.mjs';
export async function start(options={}){
 const saveDir=options.saveDir??process.env.SAVE_DIR;if(!saveDir)throw Error('BLACKICE_SEPARATE_SAVE_DIR_REQUIRED');
 return publicServer({...options,saveDir,defaultMode:'blackice',campaignModes:{blackice:{CampaignClass:Campaign,directory:'blackice-001',label:'黑冰方向营级战役',description:'独立实验新局：步兵、炮兵、反坦克与装甲；吨位后勤、有限油料与维修。旧局不转换。'}}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const service=await start();console.log('BLACKICE local candidate ready');for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await service.close();process.exit(0);});}
