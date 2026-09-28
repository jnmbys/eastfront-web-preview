import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {createLocalGameSession,controllerIdForSide,dispatchGameAction,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {deploymentHexKeysForSide} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {surveyMarkup,surveyNetwork} from '../dist/app/render/artSurvey.js';
import {coreSvgDynamicMarkup} from '../dist/app/render/coreSvg.js';
import {sharedHexEdge} from '../dist/app/geometry/hex.js';
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const s=createLocalGameSession(raw,17),p=createPresentationState(false,false);
for(const side of ['SOVIET','GERMAN']){
 const cid=controllerIdForSide(s,side);setActiveViewer(s,cid);const zone=deploymentHexKeysForSide(s.state,s.scenario,side);let n=0;
 for(const u of s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id))){const key=zone[Math.floor(n++/2)];const r=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:u.id,hex:s.state.hexes[key].coord});assert(r.result.accepted);}
 assert(dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:cid}).result.accepted);
}
const model=deriveBrowserRenderModel(s,p),before=JSON.stringify(model),svg=surveyMarkup(model);
writeFileSync('../evidence/authorized-local-snapshot.json',JSON.stringify({scope:'LOCAL RULES FIXTURE, NOT PRODUCTION SNAPSHOT; deterministic legal deployment',source:'4b9c81bf7e63e6bf1f779f3b6368084ebe9b2784',seed:17,model},null,2));
test('ART terrain covers each authorized cell exactly once without inventing classes',()=>{assert.equal(model.hexes.length,640);assert.equal((svg.match(/data-art-terrain=/g)||[]).length,model.hexes.length);for(const h of model.hexes)assert(svg.includes(`data-hex="${h.coord.q},${h.coord.r}" data-art-terrain="${h.terrain}"`));});
test('ART river segments have actual shared endpoints and casing is globally below water',()=>{const out=surveyNetwork(model);for(const e of model.edges.filter(e=>e.river)){assert(sharedHexEdge(e.a,e.b));assert(out.includes(`data-art-edge="${e.key}"`));}assert(out.lastIndexOf('class="art-river-case"')<out.indexOf('class="art-river"'));});
test('ART bridge destroyed/intact are taken from supplied authorized field only',()=>{const m=structuredClone(model),edge=m.edges.find(e=>e.bridge);assert(edge);edge.bridge.destroyed=false;assert(surveyNetwork(m).includes(`data-art-bridge="${edge.key}" data-destroyed="false"`));edge.bridge.destroyed=true;assert(surveyNetwork(m).includes(`data-art-bridge="${edge.key}" data-destroyed="true"`));});
test('ART rendering is nonmutating and introduces no unit or hidden identity',()=>{assert.equal(JSON.stringify(model),before);assert(!svg.includes('data-unit-id='));const dynamic=coreSvgDynamicMarkup(model,{debug:false});for(const c of model.counters)assert(dynamic.includes(`data-unit-id="${c.id}"`));});
test('ART empty authorized network produces no guessed bridge/route',()=>{assert.equal(surveyNetwork({...model,edges:[]}),'<g id="art-network" pointer-events="none"></g>');});
import {combatDom} from './helpers/combat-dom.mjs';
import {movementFixture} from './helpers/move001.mjs';
test('ART same-hex list reuses canonical selector and leaves MOVE001R1 target intent intact',()=>{const f=movementFixture(),pr=createPresentationState();f.state.units.friend.hex={q:0,r:0};const h=combatDom(f,pr);h.click('[data-unit-id="mover"]');assert(h.html().includes('data-art-unit="friend"'));h.click('[data-art-unit="friend"]');assert.equal(pr.selectedUnitId,'friend');assert.equal(pr.interactionMode,'SELECT');});
