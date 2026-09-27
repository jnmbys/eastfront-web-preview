import test from 'node:test';
import assert from 'node:assert/strict';
import {movementFixture} from './helpers/move001.mjs';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {selectCounter} from '../dist/app/multiplayer/playerSession.js';
import {combatDom} from './helpers/combat-dom.mjs';

function setup(full=false){const s=movementFixture(full),p=createPresentationState();selectCounter(s,p,'mover');return {s,p,h:combatDom(s,p)};}
test('MOVE001 counter retains mover and uses same draft/commit as blank target',()=>{
 for(const selector of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  const {s,p,h}=setup(),before=JSON.stringify(s.state);
  h.click(selector);assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[{q:1,r:0}]);assert.equal(JSON.stringify(s.state),before);
  h.click('#move-commit');assert.equal(s.lastResult.accepted,true);assert.deepEqual(s.state.units.mover.hex,{q:1,r:0});
 }
});
test('MOVE001 inspect, cancel, switch, origin undo and illegal targets preserve conventions',()=>{
 const {s,p,h}=setup();h.click('[data-unit-id="friend"]');h.click('[data-unit-id="mover"]');assert.deepEqual(p.pathDraft,[]);assert.equal(p.selectedUnitId,'mover');
 h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[]);assert.equal(p.message.key,'feedback.adjacentOnly');
 h.click('#move-cancel');assert.equal(p.interactionMode,'SELECT');h.click('[data-unit-id="friend"]');assert.equal(p.selectedUnitId,'friend');assert.deepEqual(p.pathDraft,[]);
 s.state.phase='GERMAN_COMBAT';p.interactionMode='SELECT';h.repaint();h.click('[data-unit-id="mover"]');assert.equal(p.selectedUnitId,'mover');
});
test('MOVE001 full stack uses existing invalid preview and Core refusal, never moves',()=>{
 for(const selector of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  const {s,p,h}=setup(true),before=JSON.stringify(s.state);h.click(selector);assert.equal(p.selectedUnitId,'mover');h.click('#move-commit');assert.equal(s.lastResult.accepted,false);assert.equal(JSON.stringify(s.state),before);
 }
});
test('MOVE001 retained nodes bind once and every consumed click stops bubbling',()=>{
 for(const selector of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  const {p,h}=setup();let calls=0;const extend=h.ctx.extendMoveDraft;h.ctx.extendMoveDraft=(...args)=>{calls++;return extend(...args);};h.ctx.bindDynamic();h.ctx.bindDynamic();
  const node=h.document.querySelector(selector);node.fire('click');assert.equal(calls,1);assert.deepEqual(p.pathDraft,[{q:1,r:0}]);assert.equal(node.lastEvent.stopped,true);
 }
});
