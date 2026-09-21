import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {harness,movementFixture,move,mapDom} from './helpers/animation-fixture.mjs';
import {battleRun,tacticalRun} from './helpers/tactical-fixture.mjs';
import {unit} from './helpers/combat-fixture.mjs';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {UnitPresenceLayer} from '../dist/app/presentation/unitPresence.js';
import {PRESENCE_PROFILE} from '../dist/app/presentation/unitPresenceTypes.js';
import {defaultRules} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
const presence=(h,id)=>h.dom().querySelector(`[data-presence-id="${id}"]`);
const json=JSON.stringify;
function level(h,lod){h.dom().querySelector('#eastfront-map').setAttribute('data-lod',lod);h.runtime.sync(h.s,h.dom());return h;}
function composition(node){const value=node.querySelector('[data-presence-ground]').getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);return {x:Number(value[1]),y:Number(value[2]),scale:Number(value[3])};}

test('UA003R1 enlarged models, ground shadows and ghosts stay inert across every LOD',()=>{
 const h=battleRun({destroy:true});for(const lod of ['far','medium','close']){level(h,lod);const layer=h.dom().querySelector('[data-unit-presence-layer]');assert.equal(layer.getAttribute('aria-hidden'),'true');for(const n of [layer,...layer.querySelectorAll('*')]){assert.equal(n.getAttribute('pointer-events'),'none');for(const attr of ['data-unit-id','data-hit-unit-id','tabindex','role','onclick'])assert.equal(n.getAttribute(attr),null);}assert.equal(layer.getAttribute('visibility'),lod==='far'?'hidden':'visible');}h.runtime.skip();assert.equal(h.dom().querySelectorAll('[data-presence-ghost]').length,0);h.runtime.dispose();
});

test('UA003R1 composition leaves all canonical Counter, NATO, damage, selection and touch markup byte-identical',()=>{
 const units=Object.entries(defaultRules.unitTemplates).map(([id,t],i)=>unit(id,id,t.side,t.type,{q:Math.floor(i/2)%5-2,r:Math.floor(i/10)-1}));units[0].step=1;units[2].step=2;const f=movementFixture(units),root=mapDom(f.s,f.p),before=root.querySelector('#counter-layer').serialize(),identities=units.map(({id,side,type})=>({id,side,type})),counters=new Map(units.map(u=>[u.id,root.counter(u.id)])),layer=new UnitPresenceLayer();
 layer.bind(root.querySelector('#counter-layer'),identities,counters);for(const lod of ['far','medium','close','medium']){layer.setLod(lod);assert.equal(root.querySelector('#counter-layer').serialize(),before);}layer.dispose();assert.equal(root.querySelector('#counter-layer').serialize(),before);
});

test('UA003R3 stack retains canonical Counter anchors and centers model ground on its owning hex',()=>{
 const h=harness(movementFixture([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0})]));const anchors=['g','p'].map(id=>h.dom().counter(id).getAttribute('transform'));
 for(const lod of ['medium','close']){level(h,lod);const comps=['g','p'].map((id,i)=>{const p=presence(h,id),counter=h.dom().counter(id),c=composition(p);assert.equal(counter.getAttribute('transform'),anchors[i]);assert.equal(p.getAttribute('transform'),anchors[i]);const contact=p.querySelector('[data-presence-contact]').querySelectorAll('ellipse')[0],ground=c.y+Number(contact.getAttribute('cy'))*c.scale+(i===0?-6:7);assert(Math.abs(ground)<1e-8);return c;});assert(comps[0].x*comps[1].x<0);assert.equal(Math.abs(comps[0].x-comps[1].x),25);}h.runtime.dispose();
});

test('UA003R1 major family profiles occupy readable Medium/Close widths without spanning a full adjacent hex',()=>{
 for(const [id,t]of Object.entries(defaultRules.unitTemplates)){const h=harness(movementFixture([unit('g',id,t.side,t.type,{q:0,r:0})]));let previous=0;for(const lod of ['medium','close']){level(h,lod);const p=presence(h,'g'),profile=PRESENCE_PROFILE[p.getAttribute('data-presence-family')],width=profile.width*composition(p).scale,counterWidth=Number(h.dom().counter('g').querySelector('.counter-body').getAttribute('width'));const hexWidth=Math.sqrt(3)*42;assert(width>hexWidth*(lod==='medium'?.55:.65));assert(width<hexWidth*(lod==='medium'?.75:.9));assert(width<90);assert(width>previous);previous=width;}h.runtime.dispose();}
});

test('UA003R1 Move and tactical playback settle to exactly the same canonical Counter and grounded composition after skip/Instant',()=>{
 for(const make of [()=>{const h=harness();dispatchGameAction(h.s,move());h.remount();return h;},()=>tacticalRun()]){for(const mode of ['normal','skip','instant']){const h=level(make(),'close'),truth=json(h.s.state);h.time.tick(120);if(mode==='skip')h.runtime.skip();else if(mode==='instant')h.runtime.setSpeed('instant');else h.finish();const canonical=level(harness({s:h.s,p:h.p}),'close');assert.equal(h.dom().querySelector('#counter-layer').serialize(),canonical.dom().querySelector('#counter-layer').serialize());assert.equal(h.dom().querySelector('[data-unit-presence-layer]').serialize(),canonical.dom().querySelector('[data-unit-presence-layer]').serialize());assert.equal(json(h.s.state),truth);assert.equal(h.time.pending(),0);assert.equal(h.dom().querySelectorAll('[data-presence-ghost]').length,0);canonical.runtime.dispose();h.runtime.dispose();}}
});

test('UA003R1 grounded playback consumes no gameplay RNG and makes no frame-time Core reads',ctx=>{
 const h=level(battleRun({multi:true}),'close'),truth=json(h.s.state),state=h.s.state;h.s.state=new Proxy(state,{get(){throw Error('Core read during visual frame');}});for(const method of ['nextFloat','rollDie','roll2D6'])ctx.mock.method(SeededRNG.prototype,method,()=>{throw Error('Gameplay RNG consumed');});ctx.mock.method(Math,'random',()=>{throw Error('Visual entropy');});for(let i=0;i<80;i++)h.time.tick(16);assert.equal(json(state),truth);h.s.state=state;h.runtime.dispose();
});

test('UA003R1 arriving into a stack interpolates display composition without a first-frame jump or remount reset',()=>{
 const h=level(harness(movementFixture([unit('g','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('a','G-INF','GERMAN','INFANTRY',{q:1,r:0})])),'close');
 const before=presence(h,'g').querySelector('[data-presence-ground]').getAttribute('transform');const result=dispatchGameAction(h.s,move('g',[{q:1,r:0}])).result;assert(result.accepted);h.remount();level(h,'close');assert.equal(presence(h,'g').querySelector('[data-presence-ground]').getAttribute('transform'),before);
 h.time.tick(100);const during=presence(h,'g').querySelector('[data-presence-ground]').getAttribute('transform');assert.notEqual(during,before);h.remount();level(h,'close');assert.equal(presence(h,'g').querySelector('[data-presence-ground]').getAttribute('transform'),during);h.runtime.skip();const canonical=level(harness({s:h.s,p:h.p}),'close');assert.equal(presence(h,'g').serialize(),presence(canonical,'g').serialize());assert.equal(h.dom().counter('g').getAttribute('transform'),presence(h,'g').getAttribute('transform'));canonical.runtime.dispose();h.runtime.dispose();
});

test('UA003R1 a real VS2 cache is unchanged by enlarged models, zoom LOD, fire and repeated remount',async()=>{
 const {createFreshProductionSession}=await import('../dist/app/web/preview.js');const {createPresentationState}=await import('../dist/app/state/presentation.js');const {deriveBrowserRenderModel}=await import('../dist/app/render/coreModel.js');const {buildCachedTerrainSurface}=await import('../dist/app/render/terrainSurface.js');const {createVS2TerrainSurfaceHooks}=await import('../dist/app/render/vs2TerrainSurface.js');
 const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')),s=createFreshProductionSession(raw,17),model=deriveBrowserRenderModel(s,createPresentationState());const oldDocument=globalThis.document,oldImage=globalThis.Image;let worldBuilds=0,draws=0;
 const pixels=new Uint8ClampedArray(8*8*4).fill(128);for(let i=3;i<pixels.length;i+=4)pixels[i]=255;class FakeImage{naturalWidth=8;naturalHeight=8;width=8;height=8;set src(v){if(v)queueMicrotask(()=>this.onload?.());}}
 const ctx=new Proxy({drawImage(){draws++;},getImageData:()=>({data:pixels}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>o[k]??(()=>{})});globalThis.Image=FakeImage;globalThis.document={baseURI:'https://example.test/map/',createElement:()=>({dataset:{},getContext:()=>ctx,setAttribute(){}})};
 try{const world=createVS2TerrainSurfaceHooks().worldBase,paint=world.paint.bind(world);const surface=await buildCachedTerrainSurface(model,17,'p5','medium',{...world,paint(...args){worldBuilds++;return paint(...args);}}),before={worldBuilds,draws,buildCount:surface.canvas.dataset.buildCount};const h=battleRun({multi:true});for(let i=0;i<80;i++){h.time.tick(16);if(i%10===0){h.remount();level(h,i%20?'medium':'close');}}assert.equal(worldBuilds,1);assert.deepEqual({worldBuilds,draws,buildCount:surface.canvas.dataset.buildCount},before);h.runtime.dispose();}finally{globalThis.document=oldDocument;globalThis.Image=oldImage;}
});

test('UA003R1 frozen baseline with explicitly recorded FOW integration and player/observer fixture updates',()=>{
 const frozen=JSON.parse(readFileSync('tests/fixtures/ua003r1-frozen-sha256.json'));for(const [path,hash]of Object.entries(frozen))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,path);
});
