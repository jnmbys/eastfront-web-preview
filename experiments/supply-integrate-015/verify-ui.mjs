// Reuse main.ts's actual event bindings in existing lightweight DOM adapter.
// This is not a browser/layout/touch test. Fetch goes to the real Python authority.
import assert from 'node:assert/strict';
import {SupplyClient} from '../../dist/app/experimental/supplyClient.js';
import {NetworkPlayerSession} from '../../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
import {combatDom} from '../../tests/helpers/combat-dom.mjs';
const origin=process.env.TEST015_ORIGIN,kind=process.env.TEST015_CASE;
const nativeFetch=globalThis.fetch;let cookie='',sent=[],dropped=false;
globalThis.window=new EventTarget();
globalThis.fetch=async(url,init)=>{
 const body=JSON.parse(init.body);sent.push(body);
 const r=await nativeFetch(new URL(url,origin),{...init,headers:{...init.headers,Origin:origin,...(cookie?{Cookie:cookie}:{})}});
 const set=r.headers.get('set-cookie');if(set)cookie=set.split(';')[0];if(kind==='lost-response'&&body.op==='action'&&!dropped){dropped=true;await r.arrayBuffer();throw new TypeError('controlled lost reply after server commit');}return r;
};
const wait=async(fn,label)=>{let start=performance.now();while(!fn()){if(performance.now()-start>12000)throw Error(label+': '+client.statusText);await new Promise(r=>setTimeout(r,10));}};
const client=new SupplyClient();await client.open('new');if(!client.state.snapshot.canAct)await client.switchSide();
const p=createPresentationState(false,false);let h;const session=new NetworkPlayerSession(client,p,kind=>{if(h&&kind!=='status'){h.repaint();session.requestProjection(p);}});
h=combatDom(session,p);session.requestProjection(p);await wait(()=>session.interactive,'initial');h.repaint();
let startRevision=session.matchRevision;
if(kind==='deployment'||kind==='lost-response'){
 const d=session.model.deployment;
 h.click(`[data-deploy-unit-id="${d.roster[0].id}"]`);h.repaint();
 h.click(`[data-deploy-destination="${d.zoneKeys[0]}"]`);h.repaint();h.click('#confirm-deployment');
 if(kind==='lost-response'){await wait(()=>!client.state.pending&&!session.interactive,'lost response');assert.match(client.statusText,/结果未知/);h.repaint();h.click('#supply-retry');}
 await wait(()=>session.matchRevision===startRevision+1&&session.interactive,'deployment');
 assert(client.supply.units.some(u=>u.id===d.roster[0].id));
}else if(kind==='movement'){
 h.click('[data-unit-id="G-PZ-01"]');await wait(()=>session.interactive&&session.renderModel().movement,'select');h.repaint();
 h.click('#move-start');await wait(()=>session.interactive&&session.renderModel().movement,'start');h.repaint();
 const option=session.model.moveOptions.find(o=>o.legal);assert(option);h.click(`[data-hex="${option.hex.q},${option.hex.r}"]`);
 await wait(()=>session.interactive&&session.renderModel().movement,'path');h.repaint();h.click('#move-commit');
 await wait(()=>session.matchRevision===startRevision+1&&session.interactive,'move');assert.equal(client.supply.receipt.charges[0].cost,4);
 // Explicit retry preserves exact request ID, revision and payload, and cannot charge twice.
 const first=sent.findLast(x=>x.op==='action');client.retry();await wait(()=>!client.state.pending&&session.interactive,'duplicate');assert.deepEqual(sent.findLast(x=>x.op==='action'),first);assert.equal(session.matchRevision,startRevision+1);
}else if(kind==='combat'){
 h.click('[data-unit-id="G-I-01"]');await wait(()=>session.interactive&&session.model.combat,'attacker');h.repaint();
 h.click('[data-hex="5,5"]');await wait(()=>session.interactive&&session.renderModel().combat?.attackDraft.preview,'target');h.repaint();
 h.click('#attack-declare');await h.paint();await wait(()=>session.matchRevision>startRevision&&session.interactive,'attack');
 assert.equal(client.supply.receipt.charges[0].cost,4);assert(session.model.combat.battle.resolution.dice);
 assert.equal(session.playerView.pendingDecision.kind,'RETREAT');h.repaint();
 const to=session.model.combat.retreat.options.find(h=>h.q===4&&h.r===4);assert(to);h.click('[data-hex="4,4"]');
 await wait(()=>session.matchRevision===startRevision+2&&session.interactive,'retreat');assert.equal(session.playerView.pendingDecision,null);
}else if(kind==='advance-delivery'){
 assert.equal(session.playerView.pendingDecision.kind,'ADVANCE_AFTER_COMBAT');
 // Map target + unit selection, using real existing post-combat controls.
 p.advanceUnitId='G-PZ-01';session.requestProjection(p);await wait(()=>session.interactive,'advance draft');h.repaint();h.click('[data-hex="4,5"]');
 await wait(()=>session.matchRevision===startRevision+1&&session.interactive,'advance');
 for(let i=0;i<8;i++){
  if(!session.canAct){h.repaint();h.click('#supply-handoff');await wait(()=>session.interactive,'handoff');}
  h.repaint();const rev=session.matchRevision;h.click('#ready-button');
  await wait(()=>session.matchRevision===rev+1&&session.ready,'phase');
 }
 assert(client.supply.receipt.settled);assert.equal(session.playerView.turn,2);h.repaint();h.click('#supply-handoff');await wait(()=>session.interactive,'delivery receipt handoff');assert(client.supply.receipt.changes.some(c=>c.id==='G-I-01'&&c.stockBefore===8&&c.stockAfter===12));
}
if(kind==='lost-response'){const actions=sent.filter(x=>x.op==='action');assert.equal(actions.length,2);assert.deepEqual(actions[0],actions[1]);assert(await client.close());}
console.log(JSON.stringify({case:kind,passed:true,revision:session.matchRevision,actions:sent.filter(x=>x.op==='action').map(x=>({type:x.action.type,id:x.id,revision:x.revision})),supply:client.supply.receipt,scope:'actual main event bindings + real HTTP Python authority; no browser layout claim'}));
session.dispose();
