import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fixture,ordinary,unit,G} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import {clock,movementFixture,move,harness,transform,mapDom,element} from './helpers/animation-fixture.mjs';
import {derivePresentationEvents} from '../dist/app/presentation/events.js';
import {observePresentationTransitions} from '../dist/app/presentation/transitionBus.js';
import {AnimationCoordinator,sequenceEvents} from '../dist/app/presentation/coordinator.js';
import {ANIMATION_TIMING as T} from '../dist/app/presentation/timing.js';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {hexToPixel} from '../dist/app/geometry/hex.js';
import {deriveCounterPlacement} from '../dist/app/render/derive.js';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
import * as intents from '../dist/app/interaction/intents.js';
import * as flow from '../dist/app/interaction/combatFlow.js';
import {setLocale,getMissingKeys,clearMissingKeys} from '../dist/app/localization/index.js';
import {animationControls,bindAnimationControls} from '../dist/app/ui/animationControls.js';

const json=JSON.stringify;
function accepted(f,action=move()) {const before=f.s.state,result=dispatchGameAction(f.s,action).result;assert(result.accepted,json(result.issues));return {before,result,events:derivePresentationEvents(before,result)};}
function freeze(value){if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;}
function travel(id='g',from={q:0,r:0},to={q:1,r:0}){return {id:`${id}:move`,actionId:'a',kind:'move',unitId:id,path:[from,to],sourceOffset:{x:0,y:0},destinationOffset:{x:0,y:0}};}

test('UA001 projection reads frozen actual Core results without mutating either GameState',()=>{
 const f=movementFixture(),{before,result}=accepted(f),snapshot=json({before,result});
 freeze(before);freeze(result);const events=derivePresentationEvents(before,result);
 assert.equal(events.length,1);assert.equal(events[0].kind,'move');assert.equal(json({before,result}),snapshot);
 assert(Object.isFrozen(events));assert(Object.isFrozen(events[0].path[0]));
 assert.notEqual(events[0].path[0],before.units.g.hex);
 assert.throws(()=>{events[0].path[0].q=999;},TypeError);
});

test('UA001 accepted MOVE retains real source and every canonical path waypoint',()=>{
 const {before,result,events}=accepted(movementFixture());
 assert.deepEqual(events[0].path,[before.units.g.hex,...result.action.path]);
 assert.deepEqual(events[0].path.at(-1),result.state.units.g.hex);
});

test('UA001 rejected moves never publish, replace state or schedule animation',()=>{
 const h=harness(),before=h.s.state;let count=0;observePresentationTransitions(h.s,()=>count++);
 const result=dispatchGameAction(h.s,move('g',[{q:20,r:0}])).result;
 assert(!result.accepted);assert.equal(h.s.state,before);assert.equal(count,0);assert.deepEqual(derivePresentationEvents(before,result),[]);assert.equal(h.time.pending(),0);
});

test('UA001 move starts at source before first frame while Core has already reached destination',()=>{
 const h=harness(),source=h.dom().counter('g').getAttribute('transform');accepted(h);h.remount();
 assert.deepEqual(h.s.state.units.g.hex,{q:1,r:1});assert.equal(h.dom().counter('g').getAttribute('transform'),source);
 assert.deepEqual(h.runtime.coordinator.snapshot().get('g').currentCanonicalPosition,hexToPixel({q:0,r:0}));
 h.time.tick(130);const position=h.runtime.coordinator.snapshot().get('g').currentCanonicalPosition;
 assert(position.x>0&&position.x<hexToPixel({q:1,r:0}).x);assert.equal(position.y,0);
});

test('UA001 multi-step movement passes exact canonical centers and settles to canonical Counter V2 destination',()=>{
 const h=harness();accepted(h);h.remount();h.time.tick(T.MOVE_STEP);
 assert.deepEqual(h.runtime.coordinator.snapshot().get('g').currentCanonicalPosition,hexToPixel({q:1,r:0}));
 h.time.tick(T.MOVE_STEP);assert.equal(h.dom().counter('g').getAttribute('transform'),transform(hexToPixel(h.s.state.units.g.hex)));
 assert.equal(h.dom().counter('g').getAttribute('data-animation-phase'),null);assert.equal(h.runtime.coordinator.busy,false);assert.equal(h.time.pending(),0);
});

test('UA001 skip and natural finish have identical counter, hit target and GameState',()=>{
 const a=harness(),b=harness();for(const h of [a,b]){accepted(h);h.remount();h.time.tick(85);}
 a.finish();b.runtime.skip();
 assert.deepEqual(a.dom().counter('g').attrs,b.dom().counter('g').attrs);assert.deepEqual(a.dom().hit('g').attrs,b.dom().hit('g').attrs);
 assert.deepEqual(a.s.state,b.s.state);assert.equal(b.time.pending(),0);assert.equal(b.runtime.coordinator.snapshot().size,0);
});

test('UA001 normal, fast and instant produce byte-identical complete GameStates',()=>{
 const runs=['normal','fast','instant'].map(speed=>{const h=harness(movementFixture(),speed);accepted(h);h.remount();h.finish();return h;});
 for(const h of runs){assert.equal(json(h.s.state),json(runs[0].s.state));assert.deepEqual(h.dom().counter('g').attrs,runs[0].dom().counter('g').attrs);}
});

test('UA001 projection, queue and rendering never call gameplay RNG or global entropy',ctx=>{
 const h=harness(),{before,result}=accepted(h);h.remount();const state=json(h.s.state);
 for(const method of ['nextFloat','rollDie','roll2D6'])ctx.mock.method(SeededRNG.prototype,method,()=>{throw Error('gameplay RNG consumed');});
 ctx.mock.method(Math,'random',()=>{throw Error('global random consumed');});
 ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw Error('entropy consumed');});
 derivePresentationEvents(before,result);for(let i=0;i<40;i++)h.time.tick(17);h.runtime.skip();
 assert.equal(json(h.s.state),state);
});

test('UA001 stack departure and arrival use frozen Counter V2 offsets; all counters settle to current layout',()=>{
 const h=harness(movementFixture([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('z','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('d','G-INF','GERMAN','INFANTRY',{q:1,r:0})]));
 const source=h.dom().counter('g').getAttribute('transform');accepted(h,move('g',[{q:1,r:0}]));h.remount();
 assert.equal(h.dom().counter('g').getAttribute('transform'),source);
 assert.equal(h.dom().counter('z').getAttribute('transform'),transform(hexToPixel({q:0,r:0})));
 const p=deriveCounterPlacement(h.s.state.units.g,1,2);h.finish();
 assert.equal(h.dom().counter('g').getAttribute('transform'),transform(p.visualCenter));
 assert.equal(h.dom().counter('g').getAttribute('data-anchor-x'),String(p.authoritativeAnchor.x));
 assert.equal(h.dom().hit('g').getAttribute('transform'),null);
});

test('UA001 moving expanded touch target follows canonical visual anchor and keeps existing identity',()=>{
 const h=harness();accepted(h);h.remount();h.time.tick(130);
 const state=h.runtime.coordinator.snapshot().get('g'),target=hexToPixel(h.s.state.units.g.hex);
 assert.equal(h.dom().hit('g').getAttribute('transform'),transform({x:state.currentCanonicalPosition.x-target.x,y:state.currentCanonicalPosition.y-target.y}));
 assert.equal(h.dom().hit('g').getAttribute('data-hit-unit-id'),'g');
});

test('UA001 camera transform remains untouched across movement frames and repeated dynamic remounts',()=>{
 const h=harness(),camera=element({transform:'translate(94px, -61px) scale(1.8)'}),terrain=element({transform:'translate(94px, -61px) scale(1.8)','data-build-count':'3'});
 accepted(h);h.remount();const snapshots=json([camera.attrs,terrain.attrs]);
 for(let i=0;i<25;i++){h.time.tick(17);h.runtime.sync(h.s,h.dom());}
 assert.equal(json([camera.attrs,terrain.attrs]),snapshots);assert.equal(camera.writes,0);assert.equal(terrain.writes,0);
 const main=readFileSync('src/main.ts','utf8');assert.match(main,/unitAnimations.sync\(session,document.querySelector\('#map-wrap'\)\)/);
});

test('UA001 language changes during and after movement preserve progress, positions and full state',()=>{
 const h=harness();accepted(h);h.remount();h.time.tick(170);const before=json(h.s.state),position=h.dom().counter('g').getAttribute('transform');
 clearMissingKeys();for(const locale of ['en-US','zh-CN']){setLocale(locale);h.remount();assert.equal(h.dom().counter('g').getAttribute('transform'),position);assert.equal(json(h.s.state),before);}
 h.finish();for(const locale of ['en-US','zh-CN']){setLocale(locale);h.remount();assert.equal(json(h.s.state),before);assert.equal(h.dom().counter('g').getAttribute('transform'),transform(hexToPixel(h.s.state.units.g.hex)));}
 assert.deepEqual(getMissingKeys(),[]);
});

test('UA001 sequential barriers hold waiting movers at actual sources without destination flash',()=>{
 const time=clock();let latest;const c=new AnimationCoordinator(time,s=>latest=s);
 c.enqueue(sequenceEvents([travel('a'),travel('b',{q:2,r:0},{q:3,r:0})]));
 assert.deepEqual(latest.get('b').currentCanonicalPosition,hexToPixel({q:2,r:0}));
 time.tick(T.MOVE_STEP);assert(!latest.has('a'));assert.equal(latest.get('b').progress,0);
 time.tick(130);assert.equal(latest.get('b').progress,.5);time.tick(130);assert(!c.busy);assert.equal(latest.size,0);
});

test('UA001 optional parallel barriers advance disjoint units together',()=>{
 const time=clock(),c=new AnimationCoordinator(time,()=>{});c.enqueue([{parallel:[travel('a'),travel('b')]}]);time.tick(130);
 assert.equal(c.snapshot().get('a').progress,.5);assert.equal(c.snapshot().get('b').progress,.5);time.tick(130);assert.equal(c.busy,false);
});

test('UA001 conflicting parallel clips serialize; long frames complete multiple barriers with cleanup',()=>{
 const time=clock(),c=new AnimationCoordinator(time,()=>{});c.enqueue([{parallel:[travel(),travel('g',{q:1,r:0},{q:2,r:0})]}]);time.tick(260);
 assert.deepEqual(c.snapshot().get('g').currentCanonicalPosition,hexToPixel({q:1,r:0}));time.tick(100000);assert.equal(c.busy,false);assert.equal(time.pending(),0);
});

test('UA001 interruption can finish the old queue and replace it without late callbacks',()=>{
 const time=clock(),c=new AnimationCoordinator(time,()=>{});c.enqueue(sequenceEvents([travel()]));time.tick(80);
 c.enqueue(sequenceEvents([travel('b')]),'finish-and-replace');assert(!c.snapshot().has('g'));assert(c.snapshot().has('b'));assert.equal(time.pending(),1);c.skip();assert.equal(time.pending(),0);
});

test('UA001 speed changes retain current interpolation and fast mode finishes sooner',()=>{
 const h=harness();accepted(h);h.remount();h.time.tick(100);const position=h.dom().counter('g').getAttribute('transform');h.runtime.setSpeed('fast');
 assert.equal(h.dom().counter('g').getAttribute('transform'),position);h.time.tick(168);assert.equal(h.runtime.coordinator.busy,false);
});

test('UA001 reduced motion settles immediately and can change during animation without altering rules',()=>{
 const h=harness();h.runtime.setReducedMotion(true);assert.equal(h.runtime.effectiveSpeed,'instant');accepted(h);h.remount();assert.equal(h.time.pending(),0);
 h.runtime.setReducedMotion(false);assert.equal(h.runtime.effectiveSpeed,'normal');const other=harness();accepted(other);other.remount();other.time.tick(100);const before=json(other.s.state);other.runtime.setReducedMotion(true);
 assert.equal(other.time.pending(),0);assert.equal(json(other.s.state),before);assert.equal(other.dom().counter('g').getAttribute('transform'),transform(hexToPixel(other.s.state.units.g.hex)));
});

test('UA001 session replacement, hidden map and disposal cancel frames and remove stale observers',()=>{
 const h=harness();accepted(h);h.remount();h.runtime.sync(null,null);assert.equal(h.time.pending(),0);
 const next=movementFixture();h.runtime.sync(next.s,mapDom(next.s,next.p));accepted(next);assert(h.time.pending());h.runtime.sync(next.s,null);assert.equal(h.time.pending(),0);
 h.runtime.dispose();assert.equal(h.time.pending(),0);assert.equal(h.runtime.coordinator.snapshot().size,0);
});

test('UA001 NEW GAME retains fresh combat seed behavior with animation runtime attached',ctx=>{
 const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));let seed=10000;
 ctx.mock.method(globalThis.crypto,'getRandomValues',array=>{array[0]=++seed;return array;});
 const h=harness();accepted(h);h.remount();const a=createFreshProductionSession(raw),b=createFreshProductionSession(raw);
 h.runtime.sync(a,null);h.runtime.sync(b,null);assert.equal(a.state.random.seed,10001);assert.equal(b.state.random.seed,10002);assert.equal(h.time.pending(),0);
});

test('UA001 ATTACK publishes setup after acceptance, fire only after resolved Core result, without delaying UX2.1',async()=>{
 const f=fixture(),h=harness(f),events=[];observePresentationTransitions(f.s,e=>events.push(...e));const dom=combatDom(f.s,f.p);
 dom.click('[data-unit-id="g"]');dom.click('[data-unit-id="d"]');dom.click('#attack-declare');await dom.paint();
 const kinds=events.map(e=>e.kind);assert(kinds.includes('combat-started'));assert(kinds.indexOf('combat-fire')>kinds.indexOf('combat-started'));assert(kinds.indexOf('combat-result')>kinds.indexOf('combat-fire'));
 assert.equal(f.s.state.pendingDecision,null);assert.equal(Object.values(f.s.state.combatTransactions)[0].stage,'CLOSED');assert(h.runtime.coordinator.busy,'Core already closed while presentation is pending');h.finish();
});

test('UA001 pending defender choice cannot enqueue fire or result before Core resolves combat',()=>{
 const f=fixture(2722,[...ordinary(),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]),events=[];observePresentationTransitions(f.s,e=>events.push(...e));
 intents.selectCounter(f.s,f.p,'g');intents.selectCounter(f.s,f.p,'d');intents.attackAndContinue(f.s,f.p);
 assert.equal(f.s.state.pendingDecision.kind,'DEFENDER_REACTION');assert.deepEqual(events.map(e=>e.kind),['combat-started']);
});

test('UA001 actual retreat, advance and breakthrough results produce ordered movement hooks',()=>{
 const f=fixture(8246,[unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})]),events=[];
 observePresentationTransitions(f.s,e=>events.push(...e));intents.selectCounter(f.s,f.p,'p');intents.selectCounter(f.s,f.p,'d');intents.attackAndContinue(f.s,f.p);
 while(f.s.state.pendingDecision?.kind==='RETREAT'){const options=flow.retreatPlan(f.s,f.p).options;flow.chooseRetreatDestination(f.s,f.p,options.find(h=>`${h.q},${h.r}`!=='1,0')??options[0]);}
 flow.chooseAdvanceDestination(f.s,f.p,{q:0,r:0});assert.equal(f.s.state.pendingDecision.kind,'BREAKTHROUGH_OPTION');
 intents.extendBreakthroughDraft(f.s,f.p,{q:1,r:0});intents.commitBreakthrough(f.s,f.p);
 const movements=events.filter(e=>'path'in e);assert.deepEqual(movements.map(e=>e.kind),['retreat','advance','breakthrough']);
 assert.deepEqual(movements[0].path[0],{q:0,r:0});assert.deepEqual(movements[1].path,[{q:-1,r:0},{q:0,r:0}]);assert.deepEqual(movements[2].path.at(-1),f.s.state.units.p.hex);
 assert(events.some(e=>e.kind==='hit'));
});

test('UA001 actual destruction yields a presentation hook without retaining combat truth',()=>{
 const units=ordinary();units[0].step=2;const f=fixture(22,units),events=[];observePresentationTransitions(f.s,e=>events.push(...e));
 intents.selectCounter(f.s,f.p,'g');intents.selectCounter(f.s,f.p,'d');intents.attackAndContinue(f.s,f.p);
 assert.equal(f.s.state.units.g.alive,false);assert(events.some(e=>e.kind==='destroyed'&&e.unitId==='g'));
 for(const e of events)assert(!('crtResult'in e)&&!('strength'in e)&&!('supplyState'in e));
});

test('UA001 combat GameState and RNG match animation-disabled flow across speeds and six seeds',()=>{
 for(const seed of [11,17,22,2722,5392,8246])for(const speed of ['normal','fast','instant']){
  const a=harness(fixture(seed),speed),b=fixture(seed);
  for(const f of [a,b]){intents.selectCounter(f.s,f.p,'g');intents.selectCounter(f.s,f.p,'d');intents.attackAndContinue(f.s,f.p);}
  assert.equal(json(a.s.state),json(b.s.state));a.finish();assert.equal(json(a.s.state),json(b.s.state));
 }
});

test('UA001 multi-attacker map selection remains intact while animation is registered',async()=>{
 const f=fixture(2722,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1})]),h=harness(f),dom=combatDom(f.s,f.p);
 for(const selector of ['[data-unit-id="g"]','[data-unit-id="d"]','[data-unit-id="g2"]'])dom.click(selector);
 assert.deepEqual(f.p.attackUnitIds,['g','g2']);dom.click('#attack-declare');await dom.paint();assert.deepEqual(Object.values(f.s.state.combatTransactions)[0].attackerUnitIds,['g','g2']);h.finish();
});

test('UA001 animation observer exceptions cannot undo or reject accepted Core actions',ctx=>{
 ctx.mock.method(console,'error',()=>{});const f=movementFixture();observePresentationTransitions(f.s,()=>{throw Error('renderer unavailable');});let called=0;observePresentationTransitions(f.s,()=>called++);
 const {result}=accepted(f);assert(result.accepted);assert.equal(called,1);assert.deepEqual(f.s.state.units.g.hex,{q:1,r:1});
});

test('UA001 frame work never writes non-unit SVG/canvas or rebuilds VS2 through repeated render',()=>{
 const h=harness(),staticNodes=h.dom().nodes.filter(el=>!el.getAttribute('data-unit-id')&&!el.getAttribute('data-hit-unit-id'));
 const initialWrites=staticNodes.map(el=>el.writes);accepted(h);h.remount();for(let i=0;i<45;i++){h.time.tick(16);if(i%10===0)h.remount();}
 assert(staticNodes.every((el,i)=>el.writes===initialWrites[i]));
 const sources=readdirSync('src/presentation').filter(n=>n.endsWith('.ts')).map(n=>readFileSync(`src/presentation/${n}`,'utf8')).join('\n');
 assert.doesNotMatch(sources,/buildCachedTerrainSurface|createVS2TerrainSurfaceHooks|coreSvgMarkup|coreSvgDynamicMarkup|setTimeout|setInterval/);
 const main=readFileSync('src/main.ts','utf8');assert.equal((main.match(/buildCachedTerrainSurface\(/g)??[]).length,1,'only the startup pipeline builder creates cached surfaces');
});

test('UA001 player animation controls are bilingual and operate without changing state',()=>{
 const h=harness();accepted(h);h.remount();const before=json(h.s.state);clearMissingKeys();
 for(const locale of ['en-US','zh-CN']){setLocale(locale);const html=animationControls(h.runtime);assert.match(html,/value="normal"/);assert.match(html,/value="fast"/);assert.match(html,/value="instant"/);assert.match(html,locale==='en-US'?/Skip animation/:/跳过动画/);}
 const handlers={},select={value:'instant',addEventListener:(_,fn)=>handlers.change=fn},button={addEventListener:(_,fn)=>handlers.skip=fn};
 bindAnimationControls({querySelector:s=>s==='#animation-speed'?select:button},h.runtime);handlers.change({currentTarget:select});handlers.skip();assert.equal(h.time.pending(),0);assert.equal(json(h.s.state),before);assert.deepEqual(getMissingKeys(),[]);
});

test('UA001 actual VS2 world cache is built once and never repainted by 60 animation frames/remounts',async()=>{
 const {deriveBrowserRenderModel}=await import('../dist/app/render/coreModel.js');
 const {createPresentationState}=await import('../dist/app/state/presentation.js');
 const {createVS2TerrainSurfaceHooks}=await import('../dist/app/render/vs2TerrainSurface.js');
 const {buildCachedTerrainSurface}=await import('../dist/app/render/terrainSurface.js');
 const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
 const session=createFreshProductionSession(raw,17),model=deriveBrowserRenderModel(session,createPresentationState());
 const oldDocument=globalThis.document,oldImage=globalThis.Image;let worldBuilds=0,draws=0;
 const pixels=new Uint8ClampedArray(8*8*4).fill(128);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;
 class FakeImage {naturalWidth=8;naturalHeight=8;width=8;height=8;set src(v){if(v)queueMicrotask(()=>this.onload?.());}}
 const ctx=new Proxy({drawImage(){draws++;},getImageData:()=>({data:pixels}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>o[k]??(()=>{})});
 globalThis.Image=FakeImage;globalThis.document={baseURI:'https://example.test/map/',createElement:()=>({dataset:{},getContext:()=>ctx,setAttribute(){}})};
 try{
  const world=createVS2TerrainSurfaceHooks().worldBase,paint=world.paint.bind(world);
  const surface=await buildCachedTerrainSurface(model,17,'p5','far',{...world,paint(...args){worldBuilds++;return paint(...args);}});
  const before={worldBuilds,draws,buildCount:surface.canvas.dataset.buildCount};
  const h=harness();accepted(h);h.remount();for(let i=0;i<60;i++){h.time.tick(16);if(i%10===0)h.remount();}
  assert.equal(worldBuilds,1);assert.deepEqual({worldBuilds,draws,buildCount:surface.canvas.dataset.buildCount},before);
 }finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});

test('UA001 combat lifecycle hooks preserve setup → fire → result → reaction order and skip notifications',()=>{
 const time=clock(),seen=[],c=new AnimationCoordinator(time,()=>{},(e,stage)=>seen.push(`${e.kind}:${stage}`));
 const cue=kind=>({id:kind,actionId:'accepted',kind,battleId:'b',unitIds:['g','d'],attackers:[]});
 c.enqueue(sequenceEvents([cue('combat-started'),cue('combat-fire'),cue('combat-result'),{id:'hit',actionId:'accepted',kind:'hit',unitId:'d',position:{x:0,y:0},participant:{unitId:'d',position:{x:0,y:0},offset:{x:0,y:0},direction:{x:1,y:0},character:'generic'}}]));
 time.tick(500);assert.deepEqual(seen,['combat-started:started','combat-started:finished','combat-fire:started','combat-fire:finished','combat-result:started','combat-result:finished','hit:started','hit:finished']);
 c.enqueue(sequenceEvents([travel()]));c.skip();assert.deepEqual(seen.slice(-2),['move:started','move:skipped']);assert.equal(time.pending(),0);
});
