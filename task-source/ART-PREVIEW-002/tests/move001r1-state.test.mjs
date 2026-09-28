import test from 'node:test';
import assert from 'node:assert/strict';
import {movementFixture} from './helpers/move001.mjs';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {combatDom} from './helpers/combat-dom.mjs';

test('MOVE001R1 selecting a unit does not implicitly capture other friendly clicks',()=>{
 const s=movementFixture(),p=createPresentationState(),h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');assert.equal(p.interactionMode,'SELECT');h.click('[data-hex="1,0"]');assert.deepEqual(p.pathDraft,[]);assert.equal(p.interactionMode,'SELECT');
 h.click('[data-unit-id="friend"]');assert.equal(p.selectedUnitId,'friend');assert.deepEqual(p.pathDraft,[]);
});
test('MOVE001R1 existing completed move must release target selection',()=>{
 const s=movementFixture(),p=createPresentationState(),h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');
 h.click('#move-start');
 h.click('[data-unit-id="friend"]');h.click('#move-commit');assert.equal(s.lastResult.accepted,true);
 assert.equal(p.interactionMode,'SELECT');h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'far');
});

test('MOVE001R1 full A -> friendly B -> confirm -> C -> confirm chain on all target surfaces',()=>{
 for(const target of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  const s=movementFixture(),p=createPresentationState(),h=combatDom(s,p);
  h.click('[data-unit-id="mover"]');h.click('#move-start');assert.equal(p.interactionMode,'MOVE_PATH');assert.deepEqual(p.pathDraft,[]);
  h.click(target);assert.equal(p.selectedUnitId,'mover');h.click('#move-commit');assert.equal(s.lastResult.accepted,true);assert.equal(p.interactionMode,'SELECT');
  h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'far');h.click('#move-start');h.click('[data-hex="2,0"]');h.click('#move-commit');assert.equal(s.lastResult.accepted,true);assert.deepEqual(s.state.units.far.hex,{q:2,r:0});assert.equal(p.interactionMode,'SELECT');
 }
});
test('MOVE001R1 exit before first step, cancel and final undo permit switching and same-hex selection',()=>{
 for(const exit of ['empty-cancel','draft-cancel','undo-button','undo-origin']){
  const s=movementFixture(),p=createPresentationState(),h=combatDom(s,p);
  h.click('[data-unit-id="mover"]');h.click('#move-start');
  if(exit!=='empty-cancel')h.click('[data-unit-id="friend"]');
  h.click(exit==='undo-button'?'#move-undo':exit==='undo-origin'?'[data-unit-id="mover"]':'#move-cancel');
  assert.equal(p.interactionMode,'SELECT');assert.deepEqual(p.pathDraft,[]);h.click('[data-unit-id="friend"]');assert.equal(p.selectedUnitId,'friend');
  s.state.units.mover.hex={q:1,r:0};h.repaint();
  for(const id of ['mover','friend','mover']){h.click(`[data-unit-id="${id}"]`);assert.equal(p.selectedUnitId,id);assert.equal(p.interactionMode,'SELECT');}
 }
});
test('MOVE001R1 full movement budget and rejected local move both release selection',()=>{
 const s=movementFixture(),p=createPresentationState(),h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');h.click('#move-start');
 for(const hex of ['-1,0','-1,1','0,1'])h.click(`[data-hex="${hex}"]`);
 const preview=h.ctx.deriveBrowserRenderModel(s,p).movement;assert.equal(preview.spentMP,preview.maxMP);
 h.click('#move-commit');assert.equal(s.lastResult.accepted,true);h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'far');
 const full=movementFixture(true),p2=createPresentationState(),h2=combatDom(full,p2);h2.click('[data-unit-id="mover"]');h2.click('#move-start');h2.click('[data-unit-id="friend"]');h2.click('#move-commit');assert.equal(full.lastResult.accepted,false);assert.equal(p2.interactionMode,'SELECT');h2.click('[data-unit-id="far"]');assert.equal(p2.selectedUnitId,'far');
});
