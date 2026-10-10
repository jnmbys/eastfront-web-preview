import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Campaign} from './authority.mjs';
import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
const envelope=(a,seat,id,payload,dependencies={})=>({instanceId:a.id,era:a.era,requestId:id,commandSeq:a.c.transport.next[seat],kind:'OPERATION',payload,dependencies});
test('two clients create same-name formal templates using authoritative receipt identity',async()=>{
 const a=new CampaignAdapter({CampaignClass:Campaign});const base=a.c.clock.divisionLedger.formal.templates['GERMAN:initial-infantry'];
 const p={type:'DIVISION_FORMAL_SAVE',baseId:base.id,expectedBaseVersion:1,draft:{...structuredClone(base),name:'同名模板'}};
 const ra=envelope(a,'a','two-client-create-a',p),rb=envelope(a,'b','two-client-create-b',p);
 const [x,y]=await Promise.all([a.submit('a',ra),a.submit('b',rb)]);
 assert.equal(x.status,'APPLIED');assert.equal(y.status,'APPLIED');assert.notEqual(x.division.templateId,y.division.templateId);assert.equal(x.division.templateVersion,1);
 assert.deepEqual(await a.submit('a',ra),x);assert.equal(a.c.clock.divisionLedger.formal.xp.GERMAN,0);
});
test('manual order generation prevents stale adoption; file restart preserves ledger and rejects old connection',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'division002-')),file=path.join(dir,'campaign.json');
 const a=new CampaignAdapter({CampaignClass:Campaign,saveFile:file});const base=a.c.clock.divisionLedger.formal.templates['GERMAN:initial-infantry'];
 const stale=envelope(a,'b','stale-adopt-command',{type:'DIVISION_FORMAL_ADOPT',unit:'G-013',expectedUnitRevision:0,templateId:base.id,expectedTemplateVersion:1},{unitGeneration:0});
 const direct=envelope(a,'a','manual-hold-command',{type:'DIRECT',unit:'G-013',order:{kind:'HOLD',target:a.c.state.units['G-013'].hex,paused:false,risk:'NORMAL'}},{unitGeneration:0});
 assert.equal((await a.submit('a',direct)).status,'APPLIED');
 const rejected=await a.submit('b',stale);assert.equal(rejected.reason,'UNIT_COMMAND_CHANGED');
 a.saveFileNow();const b=new CampaignAdapter({CampaignClass:Campaign,saveFile:file});
 assert.deepEqual(b.c.clock.divisionLedger,a.c.clock.divisionLedger);assert.ok(b.c.clock.paused);
 await assert.rejects(b.submit('a',direct),/RESTORED_SESSION/);
 assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('division002-'));fs.rmSync(dir,{recursive:true});
});
