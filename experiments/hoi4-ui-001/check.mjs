import fs from 'node:fs';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {Campaign} from '../blackice-content-002/authority.mjs';
globalThis.matchMedia=()=>({matches:false});globalThis.localStorage={getItem:()=>null};
const {window}=parseHTML('<html></html>');globalThis.window=window;globalThis.document=window.document;globalThis.location={search:'',href:'http://127.0.0.1:4281/',origin:'http://127.0.0.1:4281',pathname:'/'};
const {commandDock}=await import('../../.release-territory-preview/src/playable/commandInterface.js');
const {factoryAdjustment}=await import('../../.release-territory-preview/src/playable/productionLines.js');
const c=new Campaign(),p={data:c.snapshot(),selections:{},notice:'',locked:false,directDraft:null,directPreview:null,directFeedback:{},wireStatus:'测试'},before=JSON.stringify(c.save()),results=[];
for(const side of ['GERMAN','SOVIET']){
 c.viewer=side;p.data=c.snapshot();const unit=Object.keys(p.data.continuous.units)[0];
 for(const mode of ['','army','unit','battle','city','economy','alerts','settings','direct','tools','division','vision']){
  p.selections['ui-panel']=mode;const html=commandDock(p,unit,'');const {document}=parseHTML(html);const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,mode+' duplicate element ID');assert.equal(document.querySelectorAll('#campaign-toggle').length,1);assert(document.querySelector('[data-modern-tab="production"]'));assert(document.querySelector('[data-modern-tab="supply"]'));assert(document.querySelector('[data-ui-panel="division"]'));
  for(const el of document.querySelectorAll('[data-ui-unit]'))assert(p.data.continuous.units[el.dataset.uiUnit], 'roster includes unauthorized unit');
 }
 results.push(side+': all panels render, unique control IDs, own roster, real management entry points');
}
c.viewer='GERMAN';assert.equal(JSON.stringify(c.save()),before);results.push('rendering all panels does not mutate authority/RNG/ledger');
const m=c.snapshot().modern,line=m.lines.find(l=>l.factories.length),op=factoryAdjustment(m,line.id,-1);assert.equal(op.type,'ECON_LINE');assert.equal(op.factories.length,line.factories.length-1);c.transaction({id:'hoi-ui-production-check',version:c.version,operation:op});assert.equal(c.snapshot().modern.lines.find(l=>l.id===line.id).factories.length,op.factories.length);results.push('existing production adjustment accepted through unchanged authority');
fs.writeFileSync('evidence/hoi4-ui-001/ui-check.json',JSON.stringify({results,scope:'render/authority seams, not browser or performance'},null,2));console.log(results);
