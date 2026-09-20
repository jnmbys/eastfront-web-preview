import test from 'node:test';import assert from 'node:assert/strict';
import {renderCounter} from '../dist/app/render/coreSvg.js';import {deriveCounterPlacement} from '../dist/app/render/derive.js';
const base={id:'S-I-01',side:'SOVIET',type:'INFANTRY',step:0,stats:{attack:3,defense:3,movement:2},supplyState:'SUPPLIED',hex:{q:10,r:-4},selected:false,entrenched:false};
test('counter repaint preserves authoritative anchor, click identity, data and stats for each faction/damage state',()=>{
 for(const side of ['GERMAN','SOVIET'])for(const step of [0,1,2]){
 const c={...base,side,step},before=JSON.stringify(c),html=renderCounter(c,0,1),p=deriveCounterPlacement(c);
 assert.ok(html.includes('data-unit-id="S-I-01"'));assert.ok(html.includes('data-hex="10,-4"'));assert.ok(html.includes(`data-anchor-x="${p.authoritativeAnchor.x}"`));assert.ok(html.includes('>3-3-2</text>'));assert.equal(JSON.stringify(c),before);assert.equal(html.includes('class="damage-mark"'),step>0);assert.ok(html.includes('role="button" tabindex="0"'));
 }
});
test('stack count only appears on top counter and status markers reflect projected state',()=>{
 assert.ok(!renderCounter(base,0,2).includes('class="stack-badge"'));assert.ok(renderCounter(base,1,2).includes('2 units in this hex'));
 const html=renderCounter({...base,selected:true,entrenched:true,supplyState:'OUT_OF_SUPPLY'},0,1);assert.ok(html.includes('aria-pressed="true"'));assert.ok(html.includes('class="oos-icon"'));assert.ok(html.includes('class="entrench-icon"'));
 assert.ok(!renderCounter(base,0,1).includes('class="oos-icon"'));
});
