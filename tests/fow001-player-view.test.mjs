import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fixture,unit,G,S} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import {clock,mapDom} from './helpers/animation-fixture.mjs';
import {derivePlayerView,rememberPlayerView,SPOTTING} from '../dist/app/player-view/playerView.js';
import {filterPresentationEvents} from '../dist/app/player-view/presentationVisibility.js';
import {sessionPlayerView,setInspectionViewer,dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {switchViewerForDevelopment,selectCounter} from '../dist/app/interaction/intents.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgDynamicMarkup,coreSvgStaticMarkup} from '../dist/app/render/coreSvg.js';
import {contactMarkers} from '../dist/app/render/contactMarkers.js';
import {UnitAnimationRuntime} from '../dist/app/presentation/runtime.js';
import {observePresentationTransitions} from '../dist/app/presentation/transitionBus.js';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {setLocale,t,getMissingKeys,clearMissingKeys} from '../dist/app/localization/index.js';
const json=JSON.stringify;
const base=()=>fixture(2722,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('enemy-secret','S-INF','SOVIET','INFANTRY',{q:5,r:0})]);
const view=(s,side='GERMAN',memory)=>derivePlayerView(s.state,side,s.rules,memory);
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');

for(const side of ['GERMAN','SOVIET'])test(`FOW001 ${side} excludes hidden opposing UnitState and secret IDs`,()=>{
 const {s}=base(),v=view(s,side),enemy=side==='GERMAN'?'enemy-secret':'g';
 assert(!v.units.some(u=>u.id===enemy));assert(!json(v).includes(`"id":"${enemy}"`));assert.equal(v.authoritativeState,undefined);
 assert(!('random'in v));assert(!('actionLog'in v));assert(!('combatTransactions'in v));
});
test('FOW001 observer snapshot is complete, detached, privileged and serializable',()=>{const {s}=base(),v=view(s,'OBSERVER');assert.deepEqual(v.authoritativeState,s.state);assert.equal(v.units.length,2);v.authoritativeState.units.g.hex.q=99;assert.equal(s.state.units.g.hex.q,0);assert.deepEqual(JSON.parse(json(v)),v);});
test('FOW001 friendly units always identified with their full controller information',()=>{const {s}=base();s.state.units.g.hasMoved=true;const u=view(s).units[0];assert.equal(u.visibility,'IDENTIFIED');assert.deepEqual(u.friendly,s.state.units.g);assert.notEqual(u.friendly,s.state.units.g);});
for(const phase of ['SOVIET_DEPLOYMENT','GERMAN_DEPLOYMENT'])test(`FOW001 ${phase} never reveals even adjacent opposing setup`,()=>{
 const {s}=base();s.state.phase=phase;s.state.units['enemy-secret'].hex={q:1,r:0};
 for(const side of ['GERMAN','SOVIET']){const v=view(s,side);assert(v.units.every(u=>u.side===side));assert.deepEqual(v.contacts,[]);assert.deepEqual(v.lastKnown,[]);}
});
test('FOW001 hidden formation is absent from Counter, Presence input and accessibility markup',()=>{const {s,p}=base(),m=deriveBrowserRenderModel(s,p),svg=coreSvgDynamicMarkup(m,{debug:true});assert(!json(m).includes('enemy-secret'));assert(!svg.includes('enemy-secret'));assert(svg.includes('data-unit-id="g"'));});
test('FOW001 recon outer ring only exposes generic CONTACT with no identity/stats/stack count',()=>{
 const {s}=base();s.state.units.g.type='RECON';s.state.units.g.templateId='G-RECON';s.state.units['enemy-secret'].hex={q:3,r:0};
 const v=view(s);assert.equal(v.contacts.length,1);assert.deepEqual(Object.keys(v.contacts[0]).sort(),['contactId','hex','side','status','visibility']);assert(!json(v).includes('enemy-secret'));assert.equal(v.units.length,1);
 s.state.units['second-secret']=unit('second-secret','S-TANK','SOVIET','TANK',{q:3,r:0});assert.deepEqual(view(s).contacts,v.contacts);
});
test('FOW001 IDENTIFIED enemy exposes exactly allow-listed public fields',()=>{
 const {s}=base();s.state.units['enemy-secret'].hex={q:1,r:0};const e=view(s).units.find(u=>u.side==='SOVIET');
 assert.deepEqual(Object.keys(e).sort(),['entrenched','hex','id','side','stats','step','supplyState','type','visibility']);assert(!('templateId'in e));assert(!('friendly'in e));assert(!('hasAttacked'in e));
});
test('FOW001 recon ranges are centralized and independent of combat/movement statistics',()=>{
 const {s}=base();s.state.units['enemy-secret'].hex={q:2,r:0};assert.equal(view(s).units.length,1);s.state.units.g.type='RECON';s.state.units.g.templateId='G-RECON';assert.equal(view(s).units.length,2);assert.deepEqual(SPOTTING,{identification:1,contact:1,reconIdentification:2,reconContact:3});
});
test('FOW001 last-known memory records observation, not hidden current position or destruction',()=>{
 const {s}=base();s.state.units['enemy-secret'].hex={q:1,r:0};const memory=rememberPlayerView(view(s));
 s.state.units.g.hex={q:-4,r:0};s.state.units['enemy-secret'].hex={q:5,r:2};const v=view(s,'GERMAN',memory);assert.equal(v.lastKnown.length,1);assert.deepEqual(v.lastKnown[0].hex,{q:1,r:0});assert(!json(v).includes('enemy-secret'));assert.equal(v.contacts.length,0);
 s.state.units['enemy-secret'].alive=false;assert.deepEqual(view(s,'GERMAN',memory).lastKnown,v.lastKnown);
});
test('FOW001 returning to an observed empty hex clears stale memory; cross-side memory rejected',()=>{
 const {s}=base();s.state.units['enemy-secret'].hex={q:1,r:0};const memory=rememberPlayerView(view(s));s.state.units['enemy-secret'].hex={q:5,r:0};assert.deepEqual(view(s,'GERMAN',memory).lastKnown,[]);assert.deepEqual(view(s,'SOVIET',memory).lastKnown,[]);
});
test('FOW001 CONTACT and LAST_KNOWN markers are distinguishable and have no gameplay target',()=>{
 const {s}=base(),v=view(s);v.contacts=[{visibility:'CONTACT',contactId:'c',side:'SOVIET',hex:{q:2,r:0},status:'CURRENT'}];v.lastKnown=[{contactId:'k',side:'SOVIET',hex:{q:3,r:0},lastSeenTurn:1,status:'LAST_KNOWN',confidence:'UNCONFIRMED'}];const svg=contactMarkers(v);assert.match(svg,/data-intelligence="CURRENT"/);assert.match(svg,/data-intelligence="LAST_KNOWN"/);assert.match(svg,/stroke-dasharray/);assert.match(svg,/pointer-events="none"/);assert.doesNotMatch(svg,/data-unit-id|data-hit-unit-id|tabindex|data-presence-id/);
});
test('FOW001 viewer switching preserves canonical state, RNG and legal gameplay drafts',()=>{
 const {s,p}=fixture();p.attackUnitIds=['g'];p.primaryAttackerId='g';p.attackTarget={q:0,r:0};const truth=json(s.state),draft=json(p),controller=s.activeViewerControllerId;
 for(const side of ['GERMAN','SOVIET','OBSERVER','GERMAN']){switchViewerForDevelopment(s,p,side);sessionPlayerView(s);assert.equal(json(s.state),truth);assert.equal(json(p),draft);assert.equal(s.activeViewerControllerId,controller);}
});
test('FOW001 viewer switching keeps real UI camera transform unchanged',()=>{const {s,p}=fixture(),h=combatDom(s,p),camera=h.camera();for(const side of ['SOVIET','OBSERVER','GERMAN']){setInspectionViewer(s,side);h.repaint();assert.equal(h.camera(),camera);}});
test('FOW001 deterministic pure projection tolerates deeply frozen authoritative inputs',()=>{
 const {s}=base();const freeze=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}};const before=json(s.state);freeze(s.state);const a=view(s),b=view(s);assert.deepEqual(a,b);assert.equal(json(s.state),before);a.units[0].hex.q=88;assert.equal(s.state.units.g.hex.q,0);
});
test('FOW001 every view round-trips JSON with no hidden authoritative references',()=>{const {s}=base();for(const side of ['GERMAN','SOVIET','OBSERVER']){const v=view(s,side);assert.deepEqual(JSON.parse(json(v)),v);assert.notEqual(v.hexes[0],Object.values(s.state.hexes)[0]);}});
test('FOW001 public terrain remains complete while hidden live ownership is withheld',()=>{const {s}=base();s.state.hexes['5,0'].control='SOVIET';const v=view(s);assert.equal(v.hexes.length,Object.keys(s.state.hexes).length);assert.equal(v.hexes.find(h=>h.coord.q===5&&h.coord.r===0).control,null);});
test('FOW001 accepted hidden enemy movement publishes no visible UA facts',()=>{
 const {s}=base();s.state.phase='SOVIET_MOVEMENT';s.state.activeSide='SOVIET';let events=[];observePresentationTransitions(s,e=>events.push(...e));const r=dispatchGameAction(s,{type:'MOVE',controllerId:S,unitId:'enemy-secret',path:[{q:4,r:0}]}).result;assert(r.accepted,json(r.issues));assert.deepEqual(events,[]);
});
test('FOW001 hidden fire/hit/destroyed payloads and unknown supporters are removed',()=>{
 const {s}=fixture(),v=view(s),participant=id=>({unitId:id,position:{x:9,y:8},offset:{x:0,y:0},direction:{x:1,y:0},character:'artillery'});
 const raw=[{kind:'hit',unitId:'secret',id:'1',actionId:'a',position:{x:9,y:8},participant:participant('secret')},{kind:'destroyed',unitId:'secret',id:'2',actionId:'a',position:{x:9,y:8},participant:participant('secret')},{kind:'combat-fire',id:'3',actionId:'a',battleId:'b',unitIds:['g','d','secret'],attackers:[participant('g')],supporters:[participant('secret')]}];const e=filterPresentationEvents(raw,v,v);assert.equal(e.length,1);assert(!json(e).includes('secret'));assert.deepEqual(e[0].unitIds,['g','d']);
});
test('FOW001 enemy paths crossing unseen intermediate hexes never animate',()=>{const {s}=fixture(),v=view(s),e={kind:'move',id:'m',actionId:'a',unitId:'d',path:[{q:0,r:0},{q:5,r:5},{q:0,r:0}],sourceOffset:{x:0,y:0},destinationOffset:{x:0,y:0}};assert.deepEqual(filterPresentationEvents([e],v,v),[]);});
test('FOW001 viewer switch purges queued ghosts, active effects and RAF',()=>{
 const {s,p}=base();s.state.phase='GERMAN_MOVEMENT';const time=clock(),runtime=new UnitAnimationRuntime(time);runtime.sync(s,mapDom(s,p));dispatchGameAction(s,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0}]});assert(runtime.coordinator.busy);setInspectionViewer(s,'SOVIET');runtime.sync(s,mapDom(s,p));assert(!runtime.coordinator.busy);assert.equal(time.pending(),0);assert.equal(runtime.coordinator.snapshot().size,0);runtime.dispose();
});
test('FOW001 visible combat retains three-click flow, own Counter routing and canonical result',async()=>{const {s,p}=fixture(),h=combatDom(s,p);h.click('[data-unit-id="g"]');h.click('[data-unit-id="d"]');h.click('#attack-declare');await h.paint();assert.equal(s.state.pendingDecision,null);assert.equal(Object.values(s.state.combatTransactions)[0].stage,'CLOSED');});
test('FOW001 hidden Counter cannot be inspected by a stale UI identifier',()=>{const {s,p}=base();selectCounter(s,p,'enemy-secret');assert.equal(p.selectedUnitId,null);assert.equal(p.message.key,'fow.insufficient');});
test('FOW001 foreign decision options never enter the player DTO or command panel',()=>{const {s,p}=fixture();s.state.pendingDecision={kind:'DEFENDER_REACTION',battleId:'b',side:'SOVIET',decisionOwnerControllerId:S,eligibleControllerIds:[S],eligibleHQUnitIds:['hidden-hq'],eligibleArtilleryUnitIds:['hidden-artillery']};assert.equal(view(s).pendingDecision,null);assert.equal(deriveBrowserRenderModel(s,p).combat,null);});
test('FOW001 language changes neither intelligence memory nor canonical state',()=>{const {s}=base(),before=json(s.state),v=view(s);clearMissingKeys();for(const locale of ['zh-CN','en-US']){setLocale(locale);for(const key of ['contact','lastKnown','insufficient','view','german','soviet','observer','inspection'])assert(t(`fow.${key}`));assert.deepEqual(view(s),v);}assert.deepEqual(getMissingKeys(),[]);assert.equal(json(s.state),before);setLocale('zh-CN');});
test('FOW001 projection does not consume the fresh NEW GAME seed or gameplay RNG',()=>{const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));const a=createFreshProductionSession(raw),b=createFreshProductionSession(raw);assert.notEqual(a.state.random.seed,b.state.random.seed);const random=json(a.state.random);for(const side of ['GERMAN','SOVIET','OBSERVER'])view(a,side);assert.equal(json(a.state.random),random);});
test('FOW001 repeated projection and animation keep static terrain bytes unchanged',()=>{const {s,p}=base();s.state.phase='GERMAN_MOVEMENT';const time=clock(),runtime=new UnitAnimationRuntime(time),opts={debug:false,rendererMode:'production',staticTerrainSurface:true};const before=coreSvgStaticMarkup(deriveBrowserRenderModel(s,p),opts);runtime.sync(s,mapDom(s,p));dispatchGameAction(s,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0}]});runtime.sync(s,mapDom(s,p));for(let i=0;i<20;i++){time.tick(25);assert.equal(coreSvgStaticMarkup(deriveBrowserRenderModel(s,p),opts),before);}runtime.dispose();});
test('FOW001 Core, map, stats, camera, geometry, startup, VS2 and animation mechanics are byte frozen',()=>{const files=JSON.parse(readFileSync('tests/fixtures/fow001-frozen-sha256.json'));for(const [p,expected] of Object.entries(files))assert.equal(hash(p),expected,p);});
