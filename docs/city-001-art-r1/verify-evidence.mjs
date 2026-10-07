import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const dir='evidence/city-001-art-r1/',d=read(dir+'browser.json'),f=read(dir+'final-browser.json');
let checks=0;const check=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
const unit=s=>s.units.find(u=>u.id==='G-059');
check('input accepted while first requested detail still pending',()=>{assert(d.refiningSelection.selection.includes('G-003'));assert.equal(d.refiningSelection.terrain.lod,'far');assert.equal(d.refiningBuild.terrain.lod,'medium');assert(d.refiningBuild.city.includes('施工 0/2'));});
check('cached LOD return adds no asset requests',()=>assert.equal(d.cachedReturn.newAssetRequests,0));
check('actual factories change without terrain rebuild',()=>{assert.equal(d.cachedReturn.factories.length,5);assert.equal(d.dynamic.factories.length,6);assert.equal(new Set(d.dynamic.factories).size,6);assert.equal(d.dynamic.terrain.buildCount,d.close.buildCount);assert.equal(f.factories.length,6);assert.equal(new Set(f.factories).size,6);});
for(const [label,x] of [['cost run',d],['final build',f]]){
 check(label+' real typed production and automatic delivery',()=>{const line=x.beforeOfficer.ux.lines.find(l=>l.id==='GERMAN-industry-3');assert(line.completed.RIFLE>0);assert(x.beforeOfficer.shipments.some(s=>s.unit==='G-059'&&s.type==='RIFLE'&&s.status==='DELIVERED'));});
 check(label+' officer pays materials and repairs actual unit',()=>{assert.equal(unit(x.beforeOfficer).step,1);assert.equal(unit(x.afterOfficer).step,0);const use=x.afterOfficer.uses.find(u=>u.unitId==='G-059');assert.equal(use.rp,0);assert.equal(use.paid.filter(p=>p.type==='P').reduce((a,p)=>a+p.qty,0),1);assert.equal(use.paid.filter(p=>p.type==='RIFLE').reduce((a,p)=>a+p.qty,0),2);assert(x.afterOfficer.officers.reports.some(r=>r.accepted&&r.action.type==='REPAIR_UNIT'&&r.action.unitId==='G-059'));});
 check(label+' recovered unit legally moves and spends supply',()=>{assert.equal(x.afterMove.turn,5);assert.equal(x.afterMove.phase,'GERMAN_MOVEMENT');assert.equal(unit(x.beforeMove).hex,'21,18');assert.equal(unit(x.afterMove).hex,'21,19');assert.equal(unit(x.beforeMove).stock-unit(x.afterMove).stock,1);assert.equal(unit(x.afterMove).step,0);});
}
check('exit zeroes detached canvas and original display remains usable',()=>{assert.deepEqual(d.cleanup,{canvasWidth:0,canvasHeight:0,connected:false,terrainInDOM:false});assert.equal(d.fallback.canvas,false);assert(d.fallback.city&&d.fallback.selection);});
check('saved source and all observed assets retain exact SHA256',()=>{const m=read(dir+'source-manifest.json');for(const row of [...m.files,...m.assets])assert.equal(createHash('sha256').update(fs.readFileSync(row.path)).digest('hex'),row.sha256,row.path);});
console.log(`${checks} integration evidence checks passed; no game was run.`);
