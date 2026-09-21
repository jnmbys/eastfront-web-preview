import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {clock,harness,movementFixture,move,mapDom,transform} from './helpers/animation-fixture.mjs';
import {battleRun,tacticalRun,record,attack} from './helpers/tactical-fixture.mjs';
import {fixture,ordinary,unit,G} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import {AnimationCoordinator,eventDuration,sequenceEvents} from '../dist/app/presentation/coordinator.js';
import {SvgUnitPresentation} from '../dist/app/presentation/svgUnits.js';
import {derivePresentationEvents} from '../dist/app/presentation/events.js';
import {ANIMATION_TIMING as T} from '../dist/app/presentation/timing.js';
import {fireDelay,fireStagger,travelEase} from '../dist/app/presentation/motion.js';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {hexToPixel} from '../dist/app/geometry/hex.js';
import {setLocale} from '../dist/app/localization/index.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
const json=JSON.stringify;
const attrs=h=>h.dom().querySelectorAll('[data-unit-id]').map(node=>node.attrs);
const ghost=h=>h.dom().querySelector('[data-presentation-ghost]');
const duration=events=>sequenceEvents(events).reduce((total,step)=>total+Math.max(0,...step.parallel.map(eventDuration)),0);
const fireEnd=h=>T.COMBAT_WINDUP+eventDuration(h.events.find(e=>e.kind==='combat-fire'));
function clean(h){assert.equal(h.time.pending(),0);assert.equal(h.runtime.coordinator.snapshot().size,0);assert.equal(h.dom().querySelectorAll('[data-presentation-effect]').length,0);assert.equal(h.dom().querySelectorAll('[data-presentation-ghost]').length,0);}

// These use real RulesEngine actions. Neither the expected paths nor losses are invented.
test('UA002 MOVE has lift, eased travel and arrival settle at the identical canonical destination',()=>{
 const h=record(harness());const before=json(h.s.state);dispatchGameAction(h.s,move());h.remount();
 assert.notEqual(json(h.s.state),before);const accepted=json(h.s.state);
 h.time.tick(T.MOVE_STEP*.4);const state=h.runtime.coordinator.snapshot().get('g');
 assert(state.motionOffset.y<0);assert(state.scale>1);assert(h.dom().counter('g').querySelector('[data-presentation-effect]'));
 h.time.tick(T.MOVE_STEP*.6);assert.deepEqual(h.runtime.coordinator.snapshot().get('g').currentCanonicalPosition,hexToPixel({q:1,r:0}));
 h.finish();assert.equal(h.dom().counter('g').getAttribute('transform'),transform(hexToPixel(h.s.state.units.g.hex)));assert.equal(json(h.s.state),accepted);clean(h);
});
for(const [kind,coreType,timing] of [['retreat','UnitRetreated',T.RETREAT_STEP],['advance','UnitAdvanced',T.ADVANCE_STEP],['breakthrough','UnitBrokeThrough',T.BREAKTHROUGH_STEP]])test(`UA002 ${kind.toUpperCase()} follows the accepted Core path and exact destination`,()=>{
 const h=tacticalRun(),batch=h.batches.find(b=>b.events.some(e=>e.kind===kind)),event=batch.events.find(e=>e.kind===kind),fact=batch.coreEvents.find(e=>e.type===coreType);
 assert.deepEqual(event.path.slice(1),fact.path??[fact.to]);const time=clock(),c=new AnimationCoordinator(time,()=>{});c.enqueue(sequenceEvents([event]));
 assert.deepEqual(c.snapshot().get(event.unitId).currentCanonicalPosition,hexToPixel(event.path[0]));
 time.tick(timing*.4);assert.equal(c.snapshot().get(event.unitId).phase,kind==='retreat'?'retreating':kind==='advance'?'advancing':'breakthrough');
 time.tick(timing*(event.path.length-1-.4)-1);
 assert.deepEqual(c.snapshot().get(event.unitId).currentCanonicalPosition,hexToPixel(event.path.at(-1)));
 time.tick(1);assert.equal(c.snapshot().size,0);h.finish();clean(h);
});
test('UA002 travel profiles are observably distinct and never overshoot canonical segments',()=>{
 const h=tacticalRun(),base=h.events.find(e=>e.kind==='advance'),samples=[];
 for(const kind of ['move','retreat','advance','breakthrough']){
  const event={...base,kind},time=clock(),c=new AnimationCoordinator(time,()=>{});c.enqueue(sequenceEvents([event]));time.tick(eventDuration(event)*.4);
  const s=c.snapshot().get(event.unitId);samples.push([eventDuration(event),s.currentCanonicalPosition.x,s.motionOffset,s.scale]);
  for(let i=0;i<=100;i++){const value=travelEase(kind,i/100);assert(value>=0&&value<=1);if(i)assert(value>=travelEase(kind,(i-1)/100));}
 }
 assert.equal(new Set(samples.map(json)).size,4);h.finish();
});
test('UA002 fire occurs only after accepted CRT resolution; rejected actions and unresolved choices have no fire',()=>{
 const h=record(harness(fixture(2722,[...ordinary(),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})])));
 const rejected=dispatchGameAction(h.s,{type:'ATTACK',controllerId:G,attackerUnitIds:['missing'],target:{q:0,r:0}}).result;
 assert(!rejected.accepted);assert.deepEqual(derivePresentationEvents(h.s.state,rejected),[]);
 attack(h);assert.equal(h.s.state.pendingDecision.kind,'DEFENDER_REACTION');assert(!h.events.some(e=>e.kind==='combat-fire'));h.finish();
 const resolved=battleRun();for(const b of resolved.batches.filter(b=>b.events.some(e=>e.kind==='combat-fire')))assert(b.coreEvents.some(e=>e.type==='CRTResolved'));
 resolved.time.tick(T.COMBAT_WINDUP+T.COMBAT_FIRE/2);assert.equal(resolved.runtime.coordinator.snapshot().get('g').phase,'firing');assert(resolved.dom().counter('g').querySelector('[data-presentation-effect]'));resolved.finish();
});
test('UA002 all three actual attackers fire with bounded stagger and real unit-type character',()=>{
 const h=battleRun({multi:true}),fire=h.events.find(e=>e.kind==='combat-fire'),tx=Object.values(h.s.state.combatTransactions)[0];
 assert.deepEqual(fire.attackers.map(p=>p.unitId),tx.attackerUnitIds);assert.deepEqual(fire.attackers.map(p=>p.character),['infantry','armor','infantry']);
 h.time.tick(T.COMBAT_WINDUP+14);const first=h.runtime.coordinator.snapshot();assert(first.get('g').effect>0);assert.equal(first.get('g2').effect,0);assert.equal(first.get('g3').effect,0);
 const seen=new Set();for(let i=0;i<20;i++){h.time.tick(8);for(const s of h.runtime.coordinator.snapshot().values())if(s.phase==='firing'&&s.effect>0)seen.add(s.unitId);}
 assert.deepEqual([...seen].sort(),[...tx.attackerUnitIds].sort());assert(fireDelay(99,100)<=T.FIRE_STAGGER_CAP);assert(fireStagger(100)<=84);assert(duration(h.events)<1000);h.finish();clean(h);
});
test('UA002 hit changes only transient rendering, then restores canonical Counter damage artwork',()=>{
 const h=tacticalRun(),state=json(h.s.state),step=h.s.state.units.d.step,original=mapDom(h.s,h.p).counter('d').serialize();
 h.time.tick(fireEnd(h)+T.HIT_REACTION*.375);const cue=h.runtime.coordinator.snapshot().get('d');
 assert.equal(cue.phase,'hit');assert.notEqual(cue.motionOffset.x,0);assert.equal(h.s.state.units.d.step,step);assert.equal(json(h.s.state),state);
 h.finish();assert.equal(h.dom().counter('d').serialize(),original);clean(h);
});
test('UA002 destroyed ghost and descendants have no gameplay identity, focus or pointer target',()=>{
 const h=battleRun({destroy:true});assert.equal(h.s.state.units.g.alive,false);assert.equal(h.dom().counter('g'),null);assert.equal(h.dom().hit('g'),null);
 const node=ghost(h);assert(node);assert.equal(node.getAttribute('aria-hidden'),'true');
 for(const el of [node,...node.querySelectorAll('*')]){
  assert.equal(el.getAttribute('pointer-events'),'none');for(const key of ['data-unit-id','data-hit-unit-id','data-hex','role','tabindex','onclick'])assert.equal(el.getAttribute(key),null);
 }
 h.time.tick(fireEnd(h)+T.HIT_REACTION+T.DESTROYED/2);
 assert.equal(ghost(h).getAttribute('data-animation-phase'),'destroyed');assert(Number(ghost(h).getAttribute('opacity'))<.5);
 h.finish();assert.equal(ghost(h),null);assert.equal(h.dom().counter('g'),null);assert.equal(h.dom().hit('g'),null);clean(h);
});
for(const phase of ['firing','hit','destroyed'])test(`UA002 Skip during ${phase} settles to canonical presence/absence without residual DOM`,()=>{
 const h=battleRun({destroy:true});const accepted=json(h.s.state);
 const at=phase==='firing'?T.COMBAT_WINDUP+T.COMBAT_FIRE/2:fireEnd(h)+(phase==='hit'?T.HIT_REACTION/2:T.HIT_REACTION+T.DESTROYED/2);
 h.time.tick(at);assert.equal(h.runtime.coordinator.snapshot().get('g').phase,phase);h.runtime.skip();
 assert.equal(json(h.s.state),accepted);assert.deepEqual(attrs(h),mapDom(h.s,h.p).querySelectorAll('[data-unit-id]').map(n=>n.attrs));assert.equal(h.dom().hit('g'),null);clean(h);
});
test('UA002 normal, fast, instant and reduced motion preserve byte-identical tactical GameState and RNG',()=>{
 const runs=['normal','fast','instant'].map(tacticalRun),truth=json(runs[0].s.state);
 for(const h of runs){h.finish();assert.equal(json(h.s.state),truth);clean(h);}
 const h=tacticalRun();h.runtime.setReducedMotion(true);assert.equal(json(h.s.state),truth);clean(h);
});
test('UA002 battle playback consumes no gameplay RNG, entropy, Core query or GameState read',ctx=>{
 const h=battleRun({multi:true}),state=h.s.state,accepted=json(state);
 for(const method of ['nextFloat','rollDie','roll2D6'])ctx.mock.method(SeededRNG.prototype,method,()=>{throw Error('gameplay RNG read');});
 ctx.mock.method(Math,'random',()=>{throw Error('visual random');});ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw Error('entropy');});
 h.s.state=new Proxy(state,{get(){throw Error('per-frame GameState read');}});
 for(let i=0;i<80;i++)h.time.tick(16);h.runtime.skip();h.s.state=state;assert.equal(json(state),accepted);clean(h);
});
test('UA002 live camera zoom selects effect LOD without camera transforms or layout reads per frame',()=>{
 const h=battleRun(),root=h.dom(),svg=root.querySelector('#eastfront-map');svg.clientWidth=600;root.setAttribute('data-zoom','0.5');
 svg.setAttribute('transform','translate(94 -61) scale(1.8)');h.runtime.sync(h.s,root);h.time.tick(T.COMBAT_WINDUP+T.COMBAT_FIRE/2);
 const effect=h.dom().counter('g').querySelector('[data-presentation-effect]'),far=Number(effect.getAttribute('opacity')),camera=svg.getAttribute('transform');
 Object.defineProperty(svg,'clientWidth',{get(){throw Error('layout read in frame');}});
 root.setAttribute('data-zoom','2');h.time.tick(0);assert(Number(effect.getAttribute('opacity'))>far*4);assert.equal(svg.getAttribute('transform'),camera);h.finish();clean(h);
});
test('UA002 Combat UX2.1 actual DOM bindings retain duplicate-submit protection and map multi-selection',async()=>{
 const h=record(harness(fixture(2722,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1})]))),dom=combatDom(h.s,h.p),camera=dom.camera();
 for(const selector of ['[data-unit-id="g"]','[data-unit-id="d"]','[data-unit-id="g2"]'])dom.click(selector);
 const button=dom.click('#attack-declare');button.fire('click');await dom.paint();
 assert.equal(Object.values(h.s.state.combatTransactions).length,1);assert.deepEqual(Object.values(h.s.state.combatTransactions)[0].attackerUnitIds,['g','g2']);assert.equal(dom.camera(),camera);h.finish();
});
test('UA002 all non-presentation source, startup shell, loader, VS2, Camera and localization remain byte-identical',()=>{
 const hashes=JSON.parse(readFileSync('tests/fixtures/ua002-frozen-sha256.json'));
 for(const [path,hash]of Object.entries(hashes))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);
});
test('UA002 battle frames only update active units and reusable effect paths; no SVG rebuild or terrain writes',()=>{
 const h=tacticalRun(),root=h.dom(),nodes=root.querySelectorAll('*');
 // UA003 adds a lightweight companion layer; it is active unit artwork, not terrain.
 const presence=root.querySelector('[data-unit-presence-layer]');
 const companions=new Set(presence?[presence,...presence.querySelectorAll('*')]:[]);
 const staticNodes=nodes.filter(n=>n.getAttribute('data-unit-id')===null&&n.getAttribute('data-hit-unit-id')===null&&!companions.has(n));
 const writes=staticNodes.map(n=>n.writes),allocations=root.ownerDocument.created;
 for(let i=0;i<80;i++)h.time.tick(16);
 assert.deepEqual(staticNodes.map(n=>n.writes),writes);assert(root.ownerDocument.created-allocations<=5);assert.equal(h.dom(),root);clean(h);
});
test('UA002 ghost/effect cleanup survives repeated remount, new game, hidden map, disposal and pagehide Skip hook',()=>{
 for(const exit of ['finish','skip','new-game','hidden','dispose']){
  const h=battleRun({destroy:true});h.time.tick(T.COMBAT_WINDUP+50);
  const prior=h.dom();h.remount();assert.equal(prior.querySelectorAll('[data-presentation-ghost]').length,0);assert.equal(prior.querySelectorAll('[data-presentation-effect]').length,0);assert(ghost(h));
  if(exit==='finish')h.finish();if(exit==='skip')h.runtime.skip();if(exit==='new-game')h.runtime.sync(movementFixture().s,null);if(exit==='hidden')h.runtime.sync(h.s,null);if(exit==='dispose')h.runtime.dispose();clean(h);
 }
 assert.match(readFileSync('src/main.ts','utf8'),/addEventListener\('pagehide',\(\)=>\{unitAnimations.skip\(\);\}\)/);
});
test('UA002 language switching during fire, hit and destroyed retains exact playback and complete state',()=>{
 for(const at of [T.COMBAT_WINDUP+50,T.COMBAT_WINDUP+T.COMBAT_FIRE+50,T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION+50]){
  const h=battleRun({destroy:true});h.time.tick(at);const state=json(h.s.state),visual=json([...h.runtime.coordinator.snapshot()]);
  for(const locale of ['en-US','zh-CN']){setLocale(locale);h.remount();assert.equal(json(h.s.state),state);assert.equal(json([...h.runtime.coordinator.snapshot()]),visual);assert(ghost(h));}
  h.finish();h.remount();assert.equal(json(h.s.state),state);clean(h);
 }
 setLocale('zh-CN');
});
test('UA002 ordinary single and three-attacker sequences remain short at normal/fast speeds',()=>{
 for(const options of [{},{multi:true},{destroy:true}]){
  const h=battleRun(options),ms=duration(h.events);assert(ms<=1000);h.time.tick(ms);assert.equal(h.runtime.coordinator.busy,false);clean(h);
  const fast=battleRun({...options,speed:'fast'});fast.time.tick(ms*.4+.01);assert.equal(fast.runtime.coordinator.busy,false);clean(fast);
 }
});
test('UA002 instant destruction never leaves an interactive corpse or a pending frame',()=>{
 const h=battleRun({destroy:true,speed:'instant'});assert.equal(h.s.state.units.g.alive,false);assert.equal(h.dom().counter('g'),null);assert.equal(h.dom().hit('g'),null);clean(h);
});
test('UA002 explicit parallel fire/move conflict serializes the shared attacker',()=>{
 const h=battleRun(),fire=h.events.find(e=>e.kind==='combat-fire'),time=clock(),c=new AnimationCoordinator(time,()=>{});
 const travel={id:'next',actionId:'next',kind:'move',unitId:'g',path:[{q:-1,r:0},{q:0,r:0}],sourceOffset:{x:0,y:0},destinationOffset:{x:0,y:0}};
 c.enqueue([{parallel:[fire,travel]}]);time.tick(T.COMBAT_FIRE/2);assert.equal(c.snapshot().get('g').phase,'firing');time.tick(T.COMBAT_FIRE/2);assert.equal(c.snapshot().get('g').phase,'moving');assert.equal(c.snapshot().get('g').progress,0);c.skip();h.finish();
});
