import {Campaign} from './authority.mjs';import assert from 'node:assert/strict';import fs from 'node:fs';
const c=new Campaign(),tx=(action,operation)=>{c.viewer=c.owner();return c.transaction({id:crypto.randomUUID(),version:c.version,...(action?{action}:{operation})});};
tx(null,{type:'PRODUCTION_LINE',warehouse:'GERMAN-industry-3',product:'RIFLE'});
while(!(c.state.turn===4&&c.state.phase==='GERMAN_RECOVERY'))tx({type:'READY_FOR_PHASE_END'});c.viewer='GERMAN';
const cfg=(type,fields)=>c.delegation.config({revision:c.delegation.seat().revision,command:{type,group:'0',...fields}});
cfg('ENABLE',{enabled:true});cfg('ASSIGN',{unit:'G-059',direct:false});cfg('ORDER',{order:{kind:'REFIT',target:null}});
assert.throws(()=>tx({type:'REPAIR_UNIT',unitId:'G-059'}),/DELEGATED/);
const r=await c.delegation.tick({id:crypto.randomUUID(),version:c.version,revision:c.delegation.seat().revision});assert(r.ok,JSON.stringify(r));assert.equal(c.state.units['G-059'].step,0);assert.equal(c.econ.uses.length,1);
fs.writeFileSync('evidence/city-001/officer-typed-refit.json',JSON.stringify({result:r,uses:c.econ.uses,phase:c.state.phase,turn:c.state.turn},null,2));console.log('PASS officer typed refit / manual delegation gate / original Core recovery');
