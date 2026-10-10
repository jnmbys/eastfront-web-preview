import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';import {gunzipSync} from 'node:zlib';
import {Campaign} from './territory.mjs';import {start} from '../grand-play-mp022/server.mjs';import {ReleaseAdapter} from './persistence.mjs';import {access} from './access.mjs';
export async function releaseServer({port=Number(process.env.PORT??4247),host=process.env.HOST??'127.0.0.1',origin=process.env.PUBLIC_ORIGIN??`http://127.0.0.1:${port}`,local=process.env.RELEASE_LOCAL==='1',saveDir=process.env.SAVE_DIR??path.join(os.homedir(),'.eastfront/grand-release-territory-1'),passwordDigest=process.env.OWNER_PASSWORD_HASH,autoTick=true,CampaignClass=Campaign,mid=false,midFile=process.env.RELEASE_MID_FILE,accessControl,cookiePrefix='release001_'}={}){
 if(local&&(process.env.NODE_ENV==='production'||host!=='127.0.0.1'||!origin.startsWith('http://127.0.0.1:')))throw Error('LOCAL_MODE_LOOPBACK_ONLY');
 if(!local&&!origin.startsWith('https:')&&host!=='127.0.0.1')throw Error('PUBLIC_HTTPS_ORIGIN_REQUIRED');
 const originUrl=new URL(origin);if(originUrl.origin!==origin)throw Error('ORIGIN_MUST_BE_EXACT');
 if(!local&&!process.env.SAVE_DIR&&host!=='127.0.0.1')throw Error('PERSISTENT_SAVE_DIR_REQUIRED');
 const auth=accessControl??access({local,origin,passwordDigest});
 if(mid&&!midFile)throw Error('OLD_MID_SAVE_NOT_CONVERTED');
 class Saved extends CampaignClass{constructor(){super();if(midFile)this.restore(JSON.parse(gunzipSync(fs.readFileSync(midFile))));}}
 const router=async(req,res,adapter,reset)=>{const url=new URL(req.url,origin),json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(url.pathname==='/release/info'&&req.method==='GET'){json(200,{instanceId:adapter.id,revision:adapter.revision,tick:adapter.c.clock.tick,paused:adapter.c.clock.paused,ended:adapter.c.clock.ended,saved:adapter.persistence.savedAt,version:'GRAND-RELEASE-001',build:JSON.parse(fs.readFileSync(new URL('../../.release-territory-preview/release-build.json',import.meta.url))),local,pieceFixture:!!adapter.c.clock.pieces,divisionProfile:adapter.c.clock.divisionLedger?.profile??null,divisionIntegrated:!!adapter.c.clock.divisionLedger,mid:!!midFile});return true;}
  if(url.pathname==='/release/new'&&req.method==='POST'){if(req.headers.origin!==origin){json(403,{error:'ORIGIN_DENIED'});return true;}let body='';for await(const chunk of req){body+=chunk;if(body.length>2048){json(413,{error:'BODY_TOO_LARGE'});return true;}}try{const r=await adapter.newGame(JSON.parse(body));reset();json(200,r);}catch(e){json(409,{error:e.message});}return true;}return false;};
 return start({releaseProtocol:'GRAND-RELEASE-TERRITORY-1',staticRoot:fileURLToPath(new URL('../../.release-territory-preview/',import.meta.url)),port,host,publicOrigin:origin,AdapterClass:ReleaseAdapter,CampaignClass:midFile?Saved:CampaignClass,saveFile:path.join(saveDir,'campaign.json'),cookiePrefix,access:auth,router,release:true,autoTick});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const service=await releaseServer({mid:process.env.RELEASE_MID==='1'});console.log('GRAND-RELEASE-001 ready '+service.url);let closing=false;for(const signal of['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await service.close();process.exit(0);});
}
