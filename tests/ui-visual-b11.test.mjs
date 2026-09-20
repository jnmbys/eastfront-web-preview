import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createFreshProductionSession} from '../dist/app/web/preview.js';import {createPresentationState} from '../dist/app/state/presentation.js';import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {createDeploymentTouch,chooseDeploymentTarget} from '../dist/app/ui/deploymentTouch.js';import {deploymentFocus,deploymentRejection} from '../dist/app/ui/deploymentPolish.js';import {deploymentConfirm} from '../dist/app/ui/commandPresentation.js';import {hexPolygon} from '../dist/app/geometry/hex.js';
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
test('card selection creates exact canonical noninteractive focus; stale or private selection creates none',()=>{
 const s=createFreshProductionSession(raw,17),m=deriveBrowserRenderModel(s,createPresentationState(false,false)),ui=createDeploymentTouch(),id=m.deployment.roster[0].id,key=m.deployment.zoneKeys[0],before=JSON.stringify(s.state);
 chooseDeploymentTarget(ui,m,id,key);const focus=deploymentFocus(m,ui,id),hex=m.hexes.find(h=>`${h.coord.q},${h.coord.r}`===key);
 assert.ok(focus.includes(hexPolygon(hex.coord).map(p=>`${p.x},${p.y}`).join(' ')));assert.ok(focus.includes('pointer-events="none"'));
 assert.equal(deploymentFocus(m,ui,'other'),'');assert.equal(deploymentFocus({...m,viewerSide:'GERMAN'},ui,id),'');assert.equal(JSON.stringify(s.state),before);
 assert.ok(!deploymentConfirm(m,id,ui).includes(' disabled'));assert.ok(deploymentConfirm(m,id,createDeploymentTouch()).includes(' disabled'));
});
test('UI rejection translation preserves source issues and handles unknown codes safely',()=>{
 const issues=[{code:'STACKING_LIMIT',message:'Original technical message'}],before=JSON.stringify(issues);
 assert.equal(deploymentRejection(issues),'Maximum units reached. Choose another position.');assert.equal(JSON.stringify(issues),before);
 assert.ok(deploymentRejection([{code:'INVALID_DEPLOYMENT_HEX'}]).includes('outside your deployment area'));
 assert.ok(!deploymentRejection([{code:'<script>unrecognized</script>'}]).includes('<script>'));
});
test('tablet CSS reserves panel space through 1366px and keeps confirm outside the scroll container',()=>{
 const css=readFileSync('styles.css','utf8'),source=readFileSync('src/main.ts','utf8');
 assert.ok(css.includes('@media(min-width:761px) and (max-width:1366px)'));
 assert.ok(css.includes('.side-panel>.deployment-confirm{flex:0 0 auto'));
 assert.ok(css.includes('.menu-button,.map-control-button,.location-button,#confirm-deployment{min-height:44px;min-width:44px}'));
 assert.ok(source.includes('</div>${deploymentConfirm(model,presentation.selectedDeploymentUnitId,deploymentTouch)}'));
});
