import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import net from 'node:net';
import {execFileSync} from 'node:child_process';import {randomBytes,createHmac} from 'node:crypto';
import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';
import {campaignModes} from '../grand-release-002/server.mjs';
export async function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'equipment-public-gateway-'));const legacyDir=path.join(dir,'legacy'),mpDir=path.join(dir,'multiplayer');fs.mkdirSync(legacyDir);fs.mkdirSync(mpDir);
 const cert=path.join(dir,'test-cert.pem'),key=path.join(dir,'test-key.pem');
 const openssl=process.env.OPENSSL??(process.platform==='win32'?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl');
 execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','2','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
 const cfg={port,host:'127.0.0.1',origin:`https://localhost:${port}`,legacyDir,mpDir,cert,key};const config=path.join(dir,'config.json');fs.writeFileSync(config,JSON.stringify(cfg));
 const legacyKey=randomBytes(32),id=randomBytes(32).toString('hex'),expiry=Date.now()+86400000;fs.writeFileSync(path.join(legacyDir,'visitor-key'),legacyKey);fs.mkdirSync(path.join(legacyDir,'visitors',id),{recursive:true});fs.writeFileSync(path.join(legacyDir,'visitors',id,'visitor.json'),JSON.stringify({schema:1,createdAt:new Date().toISOString()}));
 const hashes={};for(const[mode,c]of Object.entries(campaignModes)){const adapter=new ReleaseAdapter({CampaignClass:c.CampaignClass,saveFile:path.join(legacyDir,'visitors',id,c.directory,'campaign.json')});await adapter.saveFileNow();hashes[mode]={tick:adapter.c.clock.tick};}
 const value=id+'.'+expiry,legacyCookie='grand_visitor='+value+'.'+createHmac('sha256',legacyKey).update(value).digest('hex');
 return {dir,cfg,config,ca:fs.readFileSync(cert),legacyCookie,hashes};
}
