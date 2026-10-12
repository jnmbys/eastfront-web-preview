import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Campaign} from '../hoi4-recruitment-001/authority.mjs';
import {Campaign as Old} from '../construction-occupation-r1/authority.mjs';
const results=[];
for(const mode of ['start','no-workers','no-conversion','old-mode']){
 const c=mode==='old-mode'?new Old():new Campaign(),e=c.econ.modern,side=c.viewer;
 const own=k=>Object.values(e.facilities).filter(f=>f.kind===k&&c.state.hexes[f.hex].control===side);
 const f=own('MIL')[0],l=Object.values(e.lines).find(l=>l.factories.includes(f.id));
 l.factories=[f.id];l.progress=0;
 if(mode==='no-workers')for(const x of own('CIV'))x.damage=1;
 if(mode==='old-mode')delete c.clock.factoryConversion;
 let q;
 if(['start','no-workers'].includes(mode)){
 c.transaction({id:'f1-'+mode+'-request',version:c.version,operation:{type:'ECON_BUILD',kind:'CONVERT',target:f.id,to:'CIV'}});q=e.queue.at(-1);
 }
 const points=[];
 for(let i=0;i<2;i++){c.advance();points.push({tick:c.clock.tick,production:l.progress,construction:q?.progress??0,started:q?.started??false,assigned:q?.assigned??[],starts:e.ledger.filter(x=>x.kind==='CONVERSION_STARTED'&&x.target===f.id).length});}
 results.push({mode,points});
}
const output=process.argv[2]??'after';fs.mkdirSync('evidence/factory-conversion-f1',{recursive:true});fs.writeFileSync('evidence/factory-conversion-f1/'+output+'.json',JSON.stringify(results,null,2));
for(const r of results){const [a,b]=r.points;if(r.mode==='start'){assert.equal(a.production,0,'first construction step must not produce');assert.equal(b.production,0);assert(a.construction>0);assert.equal(b.construction,2*a.construction);assert.equal(b.starts,1);assert.equal(new Set(a.assigned).size,a.assigned.length);}else{assert(a.production>0);assert(b.production>a.production);assert.equal(b.construction,0);assert.equal(b.starts,0);}}
console.log('PASS real Campaign.advance four cases / eight steps');
