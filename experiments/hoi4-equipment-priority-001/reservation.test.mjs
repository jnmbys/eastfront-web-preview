import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createInventory,validate,totals,cancelReservedFreight} from '../grand-division-002/inventory.mjs';
import {transportProgress} from '../grand-division-002/freight-progress.mjs';
import {freightPolicy,debitReception} from '../grand-division-002/reception.mjs';
import {planNetwork} from '../grand-economy-002/network.mjs';
import {canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {Campaign} from '../grand-division-002/authority.mjs';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {initializeFormal,formalTransaction} from '../grand-division-002/formal.mjs';
const I='infantry_equipment_1',S='support_equipment_1',emptyCargo=()=>({train:0,edges:{},hubs:{},sources:{}});
function fixture(){const s=createInventory({nations:{GERMAN:{manpower:0,stock:{[I]:0,[S]:1}},SOVIET:{manpower:0,stock:{[I]:0,[S]:0}}},units:{A:{id:'A',side:'GERMAN',personnel:1300,held:{[I]:110,[S]:29},target:{manpower:1300,equipment:{[I]:110,[S]:30}},revision:0,org:30,trainingExperience:0}}});const o={network:{rows:{A:{routes:[{source:'source',hub:'hub',path:['rail']}]}},hubs:[{id:'hub',capacity:.03,used:0}],sources:{},edges:{},trainUsed:0},rails:{rail:{level:1,damage:0}},trainCapacity:100,sourceCapacity:100,railCapacity:100,policy:freightPolicy,rates:{personnel:0,[I]:0,[S]:1},destination:'1,1',tick:1,cargo:emptyCargo()};return {s,o};}

for(const mode of ['complete','route-lost','unit-gone'])test(mode,()=>{const {s,o}=fixture(),before=totals(s),a=transportProgress(s,'A',o),reserved=structuredClone(s.freightReservations);const personnel=transportProgress(s,'A',{...o,phase:'personnel',rates:{personnel:0,[I]:0,[S]:0},tick:2,cargo:emptyCargo()});assert.deepEqual(s.freightReservations,reserved);assert.equal(personnel.cargo.hubs.hub??0,0);
if(mode==='unit-gone'){cancelReservedFreight(s,'A');validate(s);assert.deepEqual(totals(s),before);return;}
if(mode==='route-lost')o.rails.rail.damage=1;
const b=transportProgress(s,'A',{...o,phase:'equipment',tick:13,cargo:emptyCargo()});validate(s);assert.deepEqual(totals(s),before);assert.equal(a.cargo.hubs.hub,.03);assert.equal(s.units.A.held[S],mode==='complete'?30:29);assert.equal(Object.keys(s.freightReservations).length,0);
});
