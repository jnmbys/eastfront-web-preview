import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const dir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(dir,'../..');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const [t5,t8]=json(path.join(dir,'verified-checkpoints.json')).states;
assert.equal(t5.version,0); assert.equal(t8.version,37);
assert.equal(t5.turn,5); assert.equal(t8.turn,8);
assert.equal(t5.equipmentBudget.freeI,0); assert.equal(t5.equipmentBudget.granted,0);
assert.equal(t8.equipmentBudget.freeI,5); assert.equal(t8.personnelBudget.availableI,0);
assert.equal(t8.personnelBudget.acceptanceCareSpentI+t8.personnelBudget.carriageSpentI,2);
assert.deepEqual(t5.rearInventory,{P:0,'E2:L':0});
assert.deepEqual(t8.rearInventory,{P:1,'E2:L':2});
assert.equal(t8.care,null); assert.equal(t8.shipment,null);
assert.deepEqual(t8.frontInventory,{P:0,'E2:L':0});
const manifest=json(path.join(dir,'sources.json'));
for(const item of manifest.attachments){
 const b=fs.readFileSync(path.join(dir,item.path));
 assert.equal(b.length,item.bytes,item.path);
 assert.equal(sha(b),item.sha256,item.path);
 if(item.path.startsWith('proposals/')){
  assert.equal(b.subarray(1,4).toString(),'PNG');
  assert.equal(b.readUInt32BE(16),1512); assert.equal(b.readUInt32BE(20),1040);
 }
}
let sourceComparison='not requested; archived checkpoint only';
if(process.argv.length>=5){
 const [art,ui,backend]=process.argv.slice(2);
 assert.equal(sha(fs.readFileSync(path.join(art,'evidence/ART-MAP-015/015-x14-near.jpg'))),manifest.attachments.find(x=>x.path==='references/art015-x14-real.jpg').sha256);
 const browser=json(path.join(ui,'experiments/industry-ui-001/evidence-006/BROWSER.json'));
 const ledger=json(path.join(backend,'experiments/industry-integrate-018/LEDGER.json'));
 const keys=['turn','phase','equipmentBudget','personnelBudget','care','rearInventory','frontInventory'];
 for(const saved of [t5,t8]){
  const actual=browser.views.find(x=>x.version===saved.version);
  const row=ledger.rows.find(x=>x.version===saved.version);
  assert.ok(actual && row);
  for(const k of keys){ assert.deepEqual(saved[k],actual[k]);assert.deepEqual(saved[k],row[k]);}
 }
 sourceComparison='T5 v0 / T8 v37 match UI006 browser and backend018 ledger in 7 field groups; 015 reference byte-identical';
}
const changes=execFileSync('git',['diff','--name-only','2aa9a655e2906667929f3828d4dd6f58d7286ea2'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
const untracked=execFileSync('git',['ls-files','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
assert.ok([...changes,...untracked].every(p=>p.startsWith('research/ART-UI-DIRECTION-021/')));
console.log(JSON.stringify({status:'PASS',attachments:manifest.attachments.length,sourceComparison,scope:'research/ART-UI-DIRECTION-021 only',runtimeChanges:0,notTested:['runtime UI integration','touch and selection','300% real comparison','startup','GPU','Huawei'],imageLimitation:'Generated map labels/counter details drift; proposals are not map data or screenshots'},null,2));
