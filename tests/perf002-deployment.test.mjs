import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deploymentDom} from './helpers/deployment-dom.mjs';
import {svgDom} from './helpers/performance-dom.mjs';
import {createLocalGameSession,dispatchGameAction,setActiveViewer,sessionPlayerView} from '../dist/app/core-adapter/session.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {DynamicMapRenderer} from '../dist/app/render/dynamicMap.js';
import {coreSvgDynamicMarkup} from '../dist/app/render/coreSvg.js';
import {DeploymentPanelRenderer} from '../dist/app/ui/deploymentPanelRenderer.js';
import {deploymentLocations} from '../dist/app/ui/commandPresentation.js';
import {createDeploymentTouch} from '../dist/app/ui/deploymentTouch.js';
import {setLocale} from '../dist/app/localization/index.js';
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const fresh=()=>({s:createLocalGameSession(map,8246),p:createPresentationState()});
const options={debug:false,rendererMode:'production',staticTerrainSurface:true};
const deploy=(s,id,key)=>dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:s.activeViewerControllerId,deploymentUnitId:id,hex:Object.fromEntries(['q','r'].map((k,i)=>[k,Number(key.split(',')[i])]))}).result;
function cards(root){return root.querySelectorAll('[data-deploy-destination]').map(n=>({key:n.getAttribute('data-deploy-destination'),selected:n.getAttribute('aria-pressed'),text:n.textContent}));}
test('PERF002 location cache matches fresh markup after occupancy, latest selection, type and locale changes',()=>{
 const {s,p}=fresh(),panel=svgDom('<aside></aside>').querySelector('aside'),renderer=new DeploymentPanelRenderer(),touch=createDeploymentTouch();
 const update=(owner=s)=>{const m=deriveBrowserRenderModel(s,p);renderer.update(panel,owner,m,p.selectedDeploymentUnitId,touch,override=>`<div>${override??deploymentLocations(m,p.selectedDeploymentUnitId,touch)}</div>`);assert.deepEqual(cards(panel),cards(svgDom(deploymentLocations(m,p.selectedDeploymentUnitId,touch))));};
 const m=deriveBrowserRenderModel(s,p),key=m.deployment.zoneKeys[0];p.selectedDeploymentUnitId=m.deployment.roster[0].id;update();
 const old=panel.querySelector('.location-grid');old.scrollTop=217;
 touch.unitId=p.selectedDeploymentUnitId;touch.key=key;update();assert.equal(panel.querySelector('.location-grid'),old);
 assert(deploy(s,p.selectedDeploymentUnitId,key).accepted);p.selectedDeploymentUnitId=m.deployment.roster[1].id;update();assert.equal(panel.querySelector('.location-grid'),old);assert.equal(old.scrollTop,217);
 touch.unitId=p.selectedDeploymentUnitId;touch.key=m.deployment.zoneKeys[1];update();touch.key=key;update();
 p.selectedDeploymentUnitId=m.deployment.roster.find(r=>r.type!=='INFANTRY').id;update();assert.equal(panel.querySelector('.location-grid'),old);
 const typed=panel.querySelector('.location-grid');setLocale('en-US');update();assert.notEqual(panel.querySelector('.location-grid'),typed);setLocale('zh-CN');
});
test('PERF002 cache lifetime: new session, explicit resync, viewer, map dependency and phase invalidate',()=>{
 const {s,p}=fresh(),panel=svgDom('<aside></aside>').querySelector('aside'),renderer=new DeploymentPanelRenderer(),touch=createDeploymentTouch();p.selectedDeploymentUnitId='S-I-01';
 let m=deriveBrowserRenderModel(s,p);const update=(owner=s)=>renderer.update(panel,owner,m,p.selectedDeploymentUnitId,touch,override=>override??deploymentLocations(m,p.selectedDeploymentUnitId,touch));
 update();let old=panel.querySelector('.location-grid');update({});assert.notEqual(panel.querySelector('.location-grid'),old);
 old=panel.querySelector('.location-grid');renderer.clear();update();assert.notEqual(panel.querySelector('.location-grid'),old);
 old=panel.querySelector('.location-grid');m=structuredClone(m);const key=m.deployment.zoneKeys[0],hex=m.hexes.find(h=>`${h.coord.q},${h.coord.r}`===key);hex.terrain=hex.terrain==='HILL'?'PLAIN':'HILL';update();assert.notEqual(panel.querySelector('.location-grid'),old);
 m={...m,viewerSide:'GERMAN',playerView:{...m.playerView,viewer:'GERMAN'}};update();assert.equal(panel.querySelector('.location-grid'),null);
 m={...m,deployment:null,phase:'GERMAN_MOVEMENT'};update();assert.equal(panel.querySelector('.location-grid'),null);
});
test('PERF002 deployment map reconciles stack z-order and geometry exactly, retaining unrelated counters and zone nodes',()=>{
 const {s,p}=fresh(),renderer=new DynamicMapRenderer(),root=svgDom('<g></g>'),layer=root.querySelector('g');
 const update=()=>{const m=deriveBrowserRenderModel(s,p);renderer.update(layer,m,options);const expected=svgDom(coreSvgDynamicMarkup(m,options));for(const id of ['counter-layer','counter-hit-layer','interaction-overlays'])assert.equal(layer.querySelector('#'+id).serialize(),expected.querySelector('#'+id).serialize());};
 const m=deriveBrowserRenderModel(s,p),keys=m.deployment.zoneKeys;update();assert(deploy(s,'S-I-04',keys[2]).accepted);update();assert(deploy(s,'S-I-03',keys[0]).accepted);update();
 const stable=layer.querySelector('[data-unit-id="S-I-04"]'),zone=layer.querySelector('[data-role="deployment-hex"]');
 assert(deploy(s,'S-I-01',keys[0]).accepted);update();assert.equal(layer.querySelector('[data-unit-id="S-I-04"]'),stable);assert.equal(layer.querySelector('[data-role="deployment-hex"]'),zone);
 assert.equal(deploy(s,'S-I-02',keys[0]).accepted,false);update();assert.equal(layer.querySelector('[data-unit-id="S-I-02"]'),null);
 const german=Object.values(s.state.controllers).find(c=>c.side==='GERMAN').id;setActiveViewer(s,german);update();assert.equal(layer.querySelectorAll('[data-unit-id]').length,0);
});
test('PERF002 real main handlers: continuous deployment, stable card listeners/scroll, rejection, last unit and phase handoff',async()=>{
 const {s,p}=fresh();let renders=0;const h=await deploymentDom(s,p,{measure:(name,fn)=>{if(name==='refreshDynamicView')renders++;return fn();}});
 const initial=deriveBrowserRenderModel(s,p),roster=initial.deployment.roster,keys=initial.deployment.zoneKeys;
 try{
  h.select(roster[0].id,keys[0]);const grid=h.document.querySelector('.location-grid');grid.scrollTop=123;
  for(let i=0;i<3;i++)h.render();const target=h.document.querySelector('[data-deploy-destination="'+keys[0]+'"]');assert.equal(target._listeners.click.length,1);
  for(let i=0;i<roster.length;i++){
   h.select(roster[i].id,keys[i]);const button=h.document.querySelector('#confirm-deployment'),before=renders;
   h.click('#confirm-deployment');button.fire('click');assert.equal(renders-before,1);assert.equal(Object.keys(s.state.units).length,i+1);assert.equal(h.unitNodes().length,i+1);
   if(i<10)assert.equal(h.document.querySelector('.location-grid'),grid);
   assert.equal(h.ctx.mapViewport.zoom,1.8);assert.equal(h.ctx.mapViewport.panX,94);
  }
  assert.equal(deriveBrowserRenderModel(s,p).deployment.complete,true);h.click('#ready-button');assert.equal(s.state.phase,'GERMAN_DEPLOYMENT');assert(p.privacyGate);
 }finally{h.dispose();}
});
test('PERF002 main preserves invalid-deployment rejection without a phantom and selects latest rapid intent',async()=>{
 const {s,p}=fresh(),h=await deploymentDom(s,p);
 try{
  const m=deriveBrowserRenderModel(s,p),keys=m.deployment.zoneKeys;
  for(const id of ['S-I-01','S-I-02']){h.select(id,keys[0]);h.click('#confirm-deployment');}
  h.select('S-I-03',keys[1]);h.select('S-I-04',keys[0]);h.click('#confirm-deployment');
  assert.equal(s.lastResult.accepted,false);assert.equal(Object.keys(s.state.units).length,2);assert.equal(h.document.querySelector('[data-unit-id="S-I-04"]'),null);
  h.select('S-I-04',keys[2]);h.click('#confirm-deployment');assert.equal(s.lastResult.accepted,true);assert.equal(Object.keys(s.state.units).length,3);assert.equal(sessionPlayerView(s).units.some(u=>u.id==='S-I-03'),false);
 }finally{h.dispose();}
});
