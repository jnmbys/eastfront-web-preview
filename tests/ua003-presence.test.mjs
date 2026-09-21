import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {clock,harness,movementFixture,move,mapDom,transform} from './helpers/animation-fixture.mjs';
import {battleRun,tacticalRun,record} from './helpers/tactical-fixture.mjs';
import {fixture,ordinary,unit,G,S} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import {PRESENCE_FAMILY,PRESENCE_PALETTE,selectPresenceLod} from '../dist/app/presentation/unitPresenceTypes.js';
import {SvgUnitPresentation} from '../dist/app/presentation/svgUnits.js';
import {derivePresentationEvents} from '../dist/app/presentation/events.js';
import {eventDuration,sequenceEvents} from '../dist/app/presentation/coordinator.js';
import {ANIMATION_TIMING as T} from '../dist/app/presentation/timing.js';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {defaultRules} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
import {setLocale} from '../dist/app/localization/index.js';
const json=JSON.stringify;
const presence=(h,id)=>h.dom().querySelector(`[data-presence-id="${id}"]`);
const ghost=h=>h.dom().querySelector('[data-presence-ghost]');
const flash=(h,id)=>presence(h,id)?.querySelector('[data-presence-fire]');
function lod(h,value){h.dom().querySelector('#eastfront-map').setAttribute('data-lod',value);h.runtime.sync(h.s,h.dom());return h;}
function clean(h){assert.equal(h.time.pending(),0);assert.equal(h.runtime.coordinator.snapshot().size,0);assert.equal(h.dom().querySelectorAll('[data-presence-phase]').length,0);assert.equal(ghost(h),null);for(const el of h.dom().querySelectorAll('[data-presence-fire]'))assert.equal(el.getAttribute('opacity'),'0');}
function synchronized(h){for(const [id]of h.runtime.coordinator.snapshot()){const p=presence(h,id)??ghost(h),c=h.dom().counter(id)??h.dom().querySelector('[data-presentation-ghost]');if(p&&c)assert.equal(p.getAttribute('transform'),c.getAttribute('transform'),id);}}
// Display mode owns visibility only; all canonical Counter artwork remains byte-identical.
function canonicalCounter(node){const c=node.cloneNode(true);c.removeAttribute('data-unit-display');const face=c.querySelector('.counter-face');face?.removeAttribute('visibility');face?.removeAttribute('opacity');const plate=c.querySelector('.compact-unit');plate?.setAttribute('visibility','hidden');c.querySelector('.compact-plate')?.removeAttribute('opacity');c.querySelector('.model-hit-proxy')?.setAttribute('pointer-events','none');return c.serialize();}
const allTemplates=()=>Object.entries(defaultRules.unitTemplates).map(([id,t],i)=>unit(id,id,t.side,t.type,{q:i%5-2,r:Math.floor(i/5)-2}));
for(const level of ['far','medium','close'])test(`UA003 ${level} LOD preserves Counter and selects the expected presence detail`,()=>{
 const h=harness(),counter=canonicalCounter(h.dom().counter('g'));lod(h,level);
 assert.equal(canonicalCounter(h.dom().counter('g')),counter);
 assert.equal(h.dom().querySelector('[data-unit-presence-layer]').getAttribute('visibility'),level==='far'?'hidden':'visible');
 const p=presence(h,'g');assert(p);assert.equal(p.querySelector('use').getAttribute('href'),'#presence-infantry');
 assert.equal(p.querySelectorAll('[visibility]')[0].getAttribute('visibility'),level==='close'?'visible':'hidden');
 h.runtime.dispose();
});
test('UA003 idle zoom changes LOD through the existing camera scalar and disconnects observers',ctx=>{
 const observers=[];class Observer{constructor(cb){this.cb=cb;this.connected=false;observers.push(this);}observe(root,options){this.connected=true;this.root=root;this.options=options;}disconnect(){this.connected=false;}}
 const original=globalThis.MutationObserver;globalThis.MutationObserver=Observer;ctx.after(()=>{if(original===undefined)delete globalThis.MutationObserver;else globalThis.MutationObserver=original;});
 const h=harness(),root=h.dom(),svg=root.querySelector('#eastfront-map');svg.clientWidth=600;h.runtime.sync(h.s,root);
 const o=observers.at(-1);assert.deepEqual(o.options.attributeFilter,['data-zoom']);assert.equal(observers.filter(o=>o.connected).length,1);
 for(const [zoom,wanted]of [[.5,'far'],[1,'medium'],[2,'close']]){root.setAttribute('data-zoom',zoom);o.cb();assert.equal(root.querySelector('[data-unit-presence-layer]').getAttribute('data-presence-lod'),wanted);assert.equal(h.time.pending(),0);}
 h.runtime.dispose();assert.equal(observers.filter(o=>o.connected).length,0);
});
test('UA003 every actual template maps to an existing original visual family; no invented types',()=>{
 const units=allTemplates(),h=harness(movementFixture(units));assert.deepEqual(Object.keys(PRESENCE_FAMILY).sort(),[...new Set(units.map(u=>u.type))].sort());
 for(const u of units){const p=presence(h,u.id);assert.equal(p.getAttribute('data-presence-family'),PRESENCE_FAMILY[u.type]);assert(h.dom().querySelector(p.querySelector('use').getAttribute('href')));}
 assert.equal(h.dom().querySelectorAll('[data-presence-id]').length,units.length);h.runtime.dispose();
});
test('UA003 faction colors are deterministic and independent of locale and RNG',()=>{
 const h=harness(movementFixture(allTemplates()));for(const u of allTemplates())assert.equal(presence(h,u.id).getAttribute('color'),PRESENCE_PALETTE[u.side].body);
 assert.notEqual(PRESENCE_PALETTE.GERMAN.body,PRESENCE_PALETTE.SOVIET.body);h.runtime.dispose();
});
test('UA003 presence cannot intercept pointer/touch, focus, accessibility, or gameplay routing',()=>{
 const h=harness(),layer=h.dom().querySelector('[data-unit-presence-layer]');assert.equal(layer.getAttribute('aria-hidden'),'true');
 for(const e of [layer,...layer.querySelectorAll('*')]){assert.equal(e.getAttribute('pointer-events'),'none');for(const a of ['role','tabindex','data-unit-id','data-hit-unit-id','data-hex','onclick'])assert.equal(e.getAttribute(a),null);}
 assert.equal(h.dom().counter('g').getAttribute('role'),'button');assert(h.dom().hit('g'));h.runtime.dispose();
});
test('UA003 presence paints behind every Counter; identity, NATO symbol, stats, damage and selection remain identical',()=>{
 const f=movementFixture(),h=harness(f),expected=mapDom(f.s,f.p);assert.equal(canonicalCounter(h.dom().counter('g')),canonicalCounter(expected.counter('g')));
 const layer=h.dom().querySelector('[data-unit-presence-layer]'),c=h.dom().querySelector('#counter-layer');assert.equal(layer.parentNode,c.parentNode);assert(layer.parentNode.children.indexOf(layer)<layer.parentNode.children.indexOf(c));h.runtime.dispose();
});
test('UA003 two-unit stack uses each exact Counter anchor with separate pedestal positions',()=>{
 const h=harness(movementFixture([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('g2','G-PANZER','GERMAN','PANZER',{q:0,r:0})]));
 for(const id of ['g','g2'])assert.equal(presence(h,id).getAttribute('transform'),h.dom().counter(id).getAttribute('transform'));
 assert.notEqual(presence(h,'g').children[0].getAttribute('transform'),presence(h,'g2').children[0].getAttribute('transform'));h.runtime.dispose();
});
test('UA003 MOVE follows the existing anchor on every frame and settles to exact Counter destination',()=>{
 const h=record(harness());const from=presence(h,'g').getAttribute('transform');dispatchGameAction(h.s,move());h.remount();assert.equal(presence(h,'g').getAttribute('transform'),from);
 for(let i=0;i<40;i++){h.time.tick(16);synchronized(h);}h.finish();assert.equal(presence(h,'g').getAttribute('transform'),h.dom().counter('g').getAttribute('transform'));clean(h);
});
for(const [kind,phase]of [['retreat','retreating'],['advance','advancing'],['breakthrough','breakthrough']])test(`UA003 ${kind} stays synchronized on the accepted tactical path`,()=>{
 const h=tacticalRun();let start=0;for(const step of sequenceEvents(h.events)){if(step.parallel.some(e=>e.kind===kind))break;start+=Math.max(...step.parallel.map(eventDuration));}
 h.time.tick(start+40);assert([...h.runtime.coordinator.snapshot().values()].some(s=>s.phase===phase));synchronized(h);h.finish();clean(h);
 for(const n of h.dom().querySelectorAll('[data-presence-id]'))assert.equal(n.getAttribute('transform'),h.dom().counter(n.getAttribute('data-presence-id')).getAttribute('transform'));
});
test('UA003 no fire from selection, rejected action or unresolved combat declaration',()=>{
 const h=record(harness(fixture()));assert.equal(flash(h,'g').getAttribute('opacity'),'0');
 const rejected=dispatchGameAction(h.s,{type:'ATTACK',controllerId:G,attackerUnitIds:[],target:{q:0,r:0}}).result;assert.equal(rejected.accepted,false);assert.deepEqual(derivePresentationEvents(h.s.state,rejected),[]);
 const accepted=dispatchGameAction(h.s,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}}).result;assert(accepted.accepted);h.remount();h.time.tick(T.COMBAT_WINDUP/2);assert.equal(flash(h,'g').getAttribute('opacity'),'0');assert(!h.events.some(e=>e.kind==='combat-fire'));h.runtime.skip();clean(h);
});
test('UA003 three accepted attackers all fire, using their target directions and existing stagger',()=>{
 const h=battleRun({multi:true});const fire=h.events.find(e=>e.kind==='combat-fire');assert.deepEqual(fire.attackers.map(a=>a.unitId),['g','g2','g3']);h.time.tick(T.COMBAT_WINDUP+90);
 const values=[];for(const a of fire.attackers){assert(Number(flash(h,a.unitId).getAttribute('opacity'))>0);assert.equal(flash(h,a.unitId).getAttribute('transform'),`rotate(${Math.atan2(a.direction.y,a.direction.x)*180/Math.PI})`);values.push(flash(h,a.unitId).getAttribute('opacity'));}assert(new Set(values).size>1);synchronized(h);h.finish();clean(h);
});
function supportRun(defender=false){
 const h=record(harness(fixture(2722,[...ordinary(),unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:-2,r:0}),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})])));
 const r=dispatchGameAction(h.s,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0},support:{attackerArtilleryUnitId:'ga'}}).result;assert(r.accepted,json(r.issues));
 if(defender){const d=dispatchGameAction(h.s,{type:'COMBAT_REACTION',controllerId:S,battleId:r.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}}).result;assert(d.accepted,json(d.issues));}
 const result=dispatchGameAction(h.s,{type:'PASS_REACTION',controllerId:S,battleId:r.battleId}).result;assert(result.accepted,json(result.issues));h.remount();return h;
}
test('UA003 attacker support fires only when resolved context proves it participated',()=>{
 const h=supportRun(),fire=h.events.find(e=>e.kind==='combat-fire');assert.deepEqual(fire.supporters.map(a=>a.unitId),['ga']);assert.deepEqual(fire.attackers.map(a=>a.unitId),['g']);h.time.tick(T.COMBAT_WINDUP+90);assert(Number(flash(h,'ga').getAttribute('opacity'))>0);assert.equal(flash(h,'sa').getAttribute('opacity'),'0');h.finish();clean(h);
});
test('UA003 defensive support targets the actual attacker without changing attack group',()=>{
 const h=supportRun(true),fire=h.events.find(e=>e.kind==='combat-fire');assert.deepEqual(fire.supporters.map(a=>a.unitId),['ga','sa']);assert.deepEqual(fire.attackers.map(a=>a.unitId),['g']);h.time.tick(T.COMBAT_WINDUP+90);assert(Number(flash(h,'sa').getAttribute('opacity'))>0);h.finish();clean(h);
});
test('UA003 hit feedback leaves step, GameState and Counter damage artwork unchanged',()=>{
 const h=tacticalRun(),accepted=json(h.s.state),counter=canonicalCounter(mapDom(h.s,h.p).counter('d'));h.time.tick(T.COMBAT_WINDUP+T.COMBAT_FIRE+45);assert.equal(presence(h,'d').getAttribute('data-presence-phase'),'hit');synchronized(h);assert.equal(json(h.s.state),accepted);h.finish();assert.equal(canonicalCounter(h.dom().counter('d')),counter);clean(h);
});
test('UA003 destroyed presence is inert immediately after accepted death and fully removed at completion',()=>{
 const h=battleRun({destroy:true});assert(!presence(h,'g'));assert(ghost(h));assert.equal(h.dom().counter('g'),null);const p=ghost(h);for(const n of [p,...p.querySelectorAll('*')]){assert.equal(n.getAttribute('pointer-events'),'none');assert.equal(n.getAttribute('data-unit-id'),null);assert.equal(n.getAttribute('tabindex'),null);}assert.equal(p.getAttribute('aria-hidden'),'true');h.time.tick(T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION+80);assert.equal(ghost(h).getAttribute('data-presence-phase'),'destroyed');assert(Number(ghost(h).getAttribute('opacity'))<.5);h.finish();clean(h);assert(!presence(h,'g'));
});
for(const [phase,time]of [['fire',T.COMBAT_WINDUP+60],['hit',T.COMBAT_WINDUP+T.COMBAT_FIRE+50],['destroyed',T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION+60]])test(`UA003 Skip during ${phase} removes transient presence and retains canonical survivors`,()=>{
 const h=battleRun({destroy:true});h.time.tick(time);const truth=json(h.s.state);h.runtime.skip();assert.equal(json(h.s.state),truth);clean(h);assert(!presence(h,'g'));assert.equal(presence(h,'d').getAttribute('transform'),h.dom().counter('d').getAttribute('transform'));
});
test('UA003 Normal/Fast/Instant/reduced-motion yield identical final presence DOM and GameState',()=>{
 const hs=['normal','fast','instant'].map(tacticalRun);hs.push(tacticalRun());hs.at(-1).runtime.setReducedMotion(true);for(const h of hs)h.finish();const state=json(hs[0].s.state),dom=hs[0].dom().querySelector('[data-unit-presence-layer]').serialize();for(const h of hs){assert.equal(json(h.s.state),state);assert.equal(h.dom().querySelector('[data-unit-presence-layer]').serialize(),dom);clean(h);}
});
test('UA003 frame playback reads no GameState, gameplay RNG, entropy or layout',ctx=>{
 const h=battleRun({multi:true}),state=h.s.state,before=json(state);h.s.state=new Proxy(state,{get(){throw Error('GameState read in frame');}});for(const k of ['nextFloat','rollDie','roll2D6'])ctx.mock.method(SeededRNG.prototype,k,()=>{throw Error('gameplay RNG');});ctx.mock.method(Math,'random',()=>{throw Error('random');});ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw Error('entropy');});Object.defineProperty(h.dom().querySelector('#eastfront-map'),'clientWidth',{get(){throw Error('layout');}});for(let i=0;i<60;i++)h.time.tick(16);assert.equal(json(state),before);h.s.state=state;clean(h);
});
test('UA003 camera attributes and inactive units do not change during combat',()=>{
 const h=battleRun({multi:true}),svg=h.dom().querySelector('#eastfront-map');svg.setAttribute('transform','translate(94 -61) scale(1.8)');const before=json(svg.attrs);for(let i=0;i<50;i++)h.time.tick(16);assert.equal(json(svg.attrs),before);clean(h);
});
test('UA003 Combat UX2.1 actual UI bindings preserve three clicks and duplicate protection',async()=>{
 const h=record(harness(fixture())),ui=combatDom(h.s,h.p),camera=ui.camera();ui.click('[data-unit-id="g"]');ui.click('[data-unit-id="d"]');const b=ui.click('#attack-declare');b.fire('click');await ui.paint();h.remount();assert.equal(Object.keys(h.s.state.combatTransactions).length,1);assert.equal(ui.camera(),camera);h.finish();clean(h);
});
test('UA003 repeated remount/hidden/new game/disposal removes old companion nodes and pending runtime state',()=>{
 for(const exit of ['skip','hidden','new-game','dispose']){const h=battleRun({destroy:true});h.time.tick(170);for(let i=0;i<10;i++){const old=h.dom();h.remount();assert.equal(old.querySelectorAll('[data-unit-presence-layer]').length,0);assert.equal(old.querySelectorAll('[data-presence-definitions]').length,0);assert.equal(h.dom().querySelectorAll('[data-unit-presence-layer]').length,1);assert.equal(h.dom().querySelectorAll('[data-presence-definitions]').length,1);}if(exit==='skip')h.runtime.skip();if(exit==='hidden')h.runtime.sync(h.s,null);if(exit==='new-game')h.runtime.sync(movementFixture().s,null);if(exit==='dispose')h.runtime.dispose();clean(h);}
});
test('UA003 language remount preserves full presence state and GameState during fire',()=>{
 const h=battleRun({multi:true});h.time.tick(180);const state=json(h.s.state),visual=h.dom().querySelector('[data-unit-presence-layer]').serialize();for(const locale of ['en-US','zh-CN']){setLocale(locale);h.remount();assert.equal(json(h.s.state),state);assert.equal(h.dom().querySelector('[data-unit-presence-layer]').serialize(),visual);}h.finish();clean(h);
});
test('UA003 animation does not build terrain, clone SVG, or allocate companion elements per frame',()=>{
 const h=battleRun({multi:true}),root=h.dom(),docs=new Set([root,...root.querySelectorAll('*')].map(n=>n.ownerDocument)),before=[...docs].map(d=>d.created);const count=root.querySelectorAll('[data-presence-id]').length;for(let i=0;i<60;i++)h.time.tick(16);const allocated=[...docs].reduce((n,d,i)=>n+d.created-before[i],0);assert(allocated<=4);assert.equal(root.querySelectorAll('[data-presence-id]').length,count);clean(h);
});
test('UA003 frozen baseline with explicitly recorded FOW projection integration',()=>{
 const files=JSON.parse(readFileSync('tests/fixtures/ua003-frozen-sha256.json'));for(const [path,hash]of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);
});

test('UA003 slow pinch near LOD thresholds does not flicker or create nodes',()=>{
 let lod='far';for(const w of [55.9,56.1,55.8,57.9]){lod=selectPresenceLod(w,lod);assert.equal(lod,'far');}assert.equal(selectPresenceLod(59,lod),'medium');lod='close';for(const w of [96.1,95.9,96.2,94.5]){lod=selectPresenceLod(w,lod);assert.equal(lod,'close');}assert.equal(selectPresenceLod(93,lod),'medium');
});
test('UA003 heavy tank respects the existing smaller stacked Counter footprint',()=>{
 const heavy=unit('h','S-HEAVY','SOVIET','HEAVY_TANK',{q:0,r:0}),infantry=unit('i','S-INF','SOVIET','INFANTRY',{q:0,r:0});
 const solo=lod(harness(movementFixture([heavy])),'close'),stacked=lod(harness(movementFixture([heavy,infantry])),'close');
 const scale=h=>Number(presence(h,'h').children[0].getAttribute('transform').match(/scale\(([^)]+)\)/)[1]);assert.equal(scale(stacked),scale(solo)*.60);assert.equal(presence(stacked,'h').getAttribute('transform'),stacked.dom().counter('h').getAttribute('transform'));solo.runtime.dispose();stacked.runtime.dispose();
});
