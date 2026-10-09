import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';import {DeploymentPanelRenderer} from '../../.release-territory-preview/src/ui/deploymentPanelRenderer.js';
import {productionLines,bindProduction} from '../../.release-territory-preview/src/playable/productionLines.js';import {Campaign} from '../grand-release-001/territory.mjs';
const {window}=parseHTML('<html><body><aside id="panel"></aside></body></html>');globalThis.document=window.document;globalThis.Element=window.Element;
const c=new Campaign(),p={data:c.snapshot(),selections:{},locked:false,operation(op){this.calls.push(op);},calls:[]},panel=document.getElementById('panel'),renderer=new DeploymentPanelRenderer(),owner={},model={deployment:null};
const markup=()=>`<div class="r2-dock"><aside class="ui-sidebar"><div class="ui-content">${productionLines(p)}</div></aside></div>`;
renderer.update(panel,owner,model,null,{},markup);bindProduction(p,()=>{});
const button=panel.querySelector('[data-factory-minus]'),details=panel.querySelector('details');details.open=true;const content=panel.querySelector('.ui-content');content.scrollTop=53;
for(let i=0;i<10;i++){p.data.modern.lines[0].progress++;renderer.update(panel,owner,model,null,{},markup);bindProduction(p,()=>{});}
assert.equal(panel.querySelector('[data-factory-minus]'),button);assert.equal(panel.querySelector('details'),details);assert.equal(details.open,true);assert.equal(panel.querySelector('.ui-content'),content);assert.equal(content.scrollTop,53);button.click();assert.equal(p.calls.length,1,'No duplicated handlers after pushes');assert.equal(p.calls[0].factories.length,0);console.log('PASS: production DOM identity, open details, scroller and exactly one action after 10 authorized updates; DOM adapter, not browser rendering');
