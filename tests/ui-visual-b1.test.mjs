import { setLocale, t, enumLabel, phaseName, formatMessage } from '../dist/app/localization/index.js';
setLocale('en-US');
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createFreshProductionSession} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {selectDeploymentRosterUnit} from '../dist/app/interaction/intents.js';
import {createDeploymentTouch,chooseDeploymentTarget,confirmDeploymentTarget} from '../dist/app/ui/deploymentTouch.js';
import {deploymentLocations,deploymentConfirm,deploymentFeedback} from '../dist/app/ui/commandPresentation.js';
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const setup=()=>({s:createFreshProductionSession(raw,17),p:createPresentationState(false,false),ui:createDeploymentTouch()});
test('target selection is presentation-only; confirmation uses existing Core action and selects next reserve',()=>{
 const {s,p,ui}=setup(),m=deriveBrowserRenderModel(s,p),id=m.deployment.roster[0].id,key=m.deployment.zoneKeys[0];
 selectDeploymentRosterUnit(p,id);const before=JSON.stringify(s.state);
 assert.ok(chooseDeploymentTarget(ui,m,id,key));assert.equal(JSON.stringify(s.state),before);
 const cards=deploymentLocations(m,id,ui);assert.ok(deploymentConfirm(m,id,ui).includes('CONFIRM DEPLOYMENT'));assert.ok(cards.includes('aria-pressed="true"'));assert.ok(cards.includes('Terrain ·'));
 confirmDeploymentTarget(ui,s,p);assert.equal(s.lastResult.action.type,'DEPLOY_INITIAL_UNIT');assert.equal(s.lastResult.accepted,true);assert.equal(ui.status,'deployed');assert.notEqual(p.selectedDeploymentUnitId,id);
});
test('same-hex repeated deployment preserves Core stacking rejection and clear invalid feedback',()=>{
 const {s,p,ui}=setup();let m=deriveBrowserRenderModel(s,p);const key=m.deployment.zoneKeys[0];let rejected=false;
 for(const row of m.deployment.roster){
  selectDeploymentRosterUnit(p,row.id);m=deriveBrowserRenderModel(s,p);
  assert.ok(chooseDeploymentTarget(ui,m,row.id,key));const before=JSON.stringify(s.state);
  confirmDeploymentTarget(ui,s,p);
  assert.equal(s.lastResult.action.type,'DEPLOY_INITIAL_UNIT');
  if(!s.lastResult.accepted){assert.equal(JSON.stringify(s.state),before);assert.equal(ui.status,'invalid');assert.ok(deploymentFeedback(ui).includes('role="alert"'));assert.ok(formatMessage(ui.message).length>0);rejected=true;break;}
 }
 assert.ok(rejected,'Core must reject overstacking');
});
test('stale unit selection cannot submit the previous destination; inactive view exposes no cards',()=>{
 const {s,p,ui}=setup(),m=deriveBrowserRenderModel(s,p);selectDeploymentRosterUnit(p,m.deployment.roster[0].id);
 chooseDeploymentTarget(ui,m,p.selectedDeploymentUnitId,m.deployment.zoneKeys[0]);selectDeploymentRosterUnit(p,m.deployment.roster[1].id);
 const before=JSON.stringify(s.state);confirmDeploymentTarget(ui,s,p);assert.equal(JSON.stringify(s.state),before);assert.equal(ui.status,'invalid');
 assert.equal(deploymentLocations({...m,viewerSide:'GERMAN'},p.selectedDeploymentUnitId,ui),'');
 assert.equal(chooseDeploymentTarget(ui,m,p.selectedDeploymentUnitId,'999,999'),false);
});
