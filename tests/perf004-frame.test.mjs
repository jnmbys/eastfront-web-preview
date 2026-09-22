import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fogCases} from '../scripts/perf004/fog-cases.mjs';
import {rasterizeFog} from '../dist/app/fog/surface.js';
import {deploymentDom} from './helpers/deployment-dom.mjs';
import {createLocalGameSession,sessionPlayerView,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {UnitPresenceLayer} from '../dist/app/presentation/unitPresence.js';
import {svgDom} from './helpers/performance-dom.mjs';
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const fresh=()=>({s:createLocalGameSession(map,8246),p:createPresentationState()});
test('PERF004 all 32 deployment masks and recon overlays match original RGBA exactly; viewer switch remains private',()=>{
 const gold=JSON.parse(readFileSync('tests/fixtures/perf004-fog-baseline.json')).rows;
 const actual=fogCases().map(({name,plan,kind})=>{const r=rasterizeFog(plan,kind);return{name,width:r.width,height:r.height,sha256:createHash('sha256').update(r.rgba).digest('hex')};});
 assert.deepEqual(actual,gold);
});
test('PERF004 panel ancestors never detach, roster listeners remain single, and latest confirmed selection is retained',async()=>{
 const {s,p}=fresh(),h=await deploymentDom(s,p);
 try{
  const d=deriveBrowserRenderModel(s,p).deployment;h.select(d.roster[0].id,d.zoneKeys[0]);
  const locations=h.document.querySelector('.deployment-locations'),ancestors=[];
  for(let el=locations;el&&el!==h.document.querySelector('#side-panel');el=el.parentElement)ancestors.push(el);
  // A preserved identity alone would miss PERF002's detach/reattach layout bug.
  for(const el of ancestors){el.remove=()=>{throw Error('Retained ancestor detached');};}
  const untouched=h.document.querySelector('[data-deploy-unit-id="'+d.roster[8].id+'"]');
  const scroll=h.document.querySelector('.command-panel-scroll');scroll.scrollTop=231;
  for(const selector of ['.command-panel-scroll','.roster-list','.location-grid'])Object.defineProperty(h.document.querySelector(selector),'scrollTop',{get(){throw Error('Retained scroll read forced layout');},set(){throw Error('Retained scroll restoration forced layout');},configurable:true});
  for(let i=0;i<6;i++){
   h.select(d.roster[i].id,d.zoneKeys[i]);h.render();h.render();
   assert(h.document.querySelector('[data-deploy-unit-id="'+d.roster[8].id+'"]')===untouched,'untouched roster row');
   assert.equal(untouched._listeners.click.length,1);
   h.click('#confirm-deployment');assert.equal(sessionPlayerView(s).units.length,i+1);
   assert(h.document.querySelector('.command-panel-scroll')===scroll,'scroll retained');assert(Object.getOwnPropertyDescriptor(scroll,'scrollTop').get);
  }
 }finally{h.dispose();}
});
test('PERF004 Presence retains unrelated models and definitions, updates stacked anchors/order identically to fresh render, and clears viewer state',async()=>{
 const {s,p}=fresh(),h=await deploymentDom(s,p);
 try{
  const d=deriveBrowserRenderModel(s,p).deployment,layer=()=>h.document.querySelector('[data-unit-presence-layer]');
  h.select(d.roster[0].id,d.zoneKeys[0]);h.click('#confirm-deployment');
  let first=h.document.querySelector('[data-presence-id="'+d.roster[0].id+'"]');const defs=h.document.querySelector('[data-presence-definitions]');
  for(let i=1;i<5;i++){
   h.click('[data-deploy-unit-id="'+d.roster[i].id+'"]');h.select(d.roster[i].id,d.zoneKeys[i===2?1:i]);h.click('#confirm-deployment');
   // The first prior selection changes on the second accepted action. Thereafter
   // this unit's canonical input is unchanged, including when another stack grows.
   if(i===1)first=h.document.querySelector('[data-presence-id="'+d.roster[0].id+'"]');
   else assert(h.document.querySelector('[data-presence-id="'+d.roster[0].id+'"]')===first,'first model retained');
   assert(h.document.querySelector('[data-presence-definitions]')===defs,'definitions retained');
   const clone=svgDom('<svg><g id="counter-layer">'+h.document.querySelector('#counter-layer').innerHTML+'</g></svg>');
   const expected=new UnitPresenceLayer();expected.bind(clone.querySelector('#counter-layer'),sessionPlayerView(s).units,new Map(clone.querySelectorAll('[data-unit-id]').map(n=>[n.getAttribute('data-unit-id'),n])));expected.setLod(layer().getAttribute('data-presence-lod'));
   assert.equal(layer().serialize(),clone.querySelector('[data-unit-presence-layer]').serialize());expected.dispose();
  }
  const before=layer();h.animations.setModelDisplay('off');assert.equal(before.getAttribute('visibility'),'hidden');h.animations.setModelDisplay('auto');assert(layer()===before);
  setActiveViewer(s,Object.values(s.state.controllers).find(c=>c.side==='GERMAN').id);h.change('view');
  assert.equal(h.document.querySelectorAll('[data-presence-id]').length,0);assert.equal(h.unitNodes().length,0);
 }finally{h.dispose();}
});
