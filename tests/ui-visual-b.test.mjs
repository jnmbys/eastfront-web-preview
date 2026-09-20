import { setLocale, t, enumLabel, phaseName, formatMessage } from '../dist/app/localization/index.js';
setLocale('en-US');
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {deploymentLocations,commandHeader} from '../dist/app/ui/commandPresentation.js';
import {selectDeploymentRosterUnit,deploySelectedUnit} from '../dist/app/interaction/intents.js';
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
test('large deployment controls use only projected positions and preserve Core dispatch',()=>{
 const s=createFreshProductionSession(raw,17),p=createPresentationState(false,false),m=deriveBrowserRenderModel(s,p);
 const before=JSON.stringify(s.state),id=m.deployment.roster[0].id;
 assert.equal(deploymentLocations(m,null),'');
 const html=deploymentLocations(m,id),keys=[...html.matchAll(/data-deploy-destination="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(keys,m.deployment.zoneKeys);assert.equal(JSON.stringify(s.state),before);
 assert.equal(deploymentLocations({...m,viewerSide:'GERMAN'},id),'');
 selectDeploymentRosterUnit(p,id);const [q,r]=keys[0].split(',').map(Number);deploySelectedUnit(s,p,{q,r});
 assert.equal(s.lastResult.accepted,true);assert.equal(s.lastResult.action.type,'DEPLOY_INITIAL_UNIT');
 assert.equal(deploymentLocations(deriveBrowserRenderModel(s,p),id),'');
});
test('command HUD displays authoritative phase side and turn without inventing date',()=>{
 const s=createFreshProductionSession(raw,17),m=deriveBrowserRenderModel(s,createPresentationState(false,false));
 const html=commandHeader(m);assert.ok(html.includes(m.activeSide));assert.ok(html.includes(t('game.turn',{turn:m.turn})));assert.ok(html.includes(phaseName(m.phase,false)));assert.ok(!html.includes('1941'));
});
