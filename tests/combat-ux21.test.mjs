import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {G,S,unit,ordinary,fixture} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import * as intents from '../dist/app/interaction/intents.js';
import {eligibleAdditionalAttackerIds} from '../dist/app/interaction/attackGroup.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {buildCombatContext,validateAttackAction} from '../dist/app/core-adapter/core.js';
import {bindLanguageControl} from '../dist/app/localization/languageControl.js';
import {setLocale,formatMessage,getMissingKeys,clearMissingKeys} from '../dist/app/localization/index.js';
import {enUS} from '../dist/app/localization/en-US.js';
import {zhCN} from '../dist/app/localization/zh-CN.js';
const groupUnits=()=>[
 unit('z-primary','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),
 unit('a-infantry','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),
 unit('b-jager','G-JAGER','GERMAN','JAGER',{q:1,r:-1}),
 unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0}),
];
function setup(seed=17){const f=fixture(seed,groupUnits());return {...f,h:combatDom(f.s,f.p)};}
function target(h){h.click('[data-unit-id="z-primary"]');h.click('[data-unit-id="d"]');}
function action(p){return {type:'ATTACK',controllerId:G,attackerUnitIds:[...p.attackUnitIds],target:{...p.attackTarget},...(p.attackerArtilleryUnitId?{support:{attackerArtilleryUnitId:p.attackerArtilleryUnitId}}:{})};}

test('UX2.1 one-on-one still closes through exactly three actual UI clicks',async()=>{
 const {s,p}=fixture(),h=combatDom(s,p);let clicks=0;
 for(const selector of ['[data-unit-id="g"]','[data-unit-id="d"]','#attack-declare']){h.click(selector);clicks++;}
 await h.paint();assert.equal(clicks,3);assert.equal(s.state.pendingDecision,null);
 assert.equal(Object.values(s.state.combatTransactions)[0].stage,'CLOSED');
 assert.doesNotMatch(h.html(),/id="(?:attack-confirm|resolve-combat|declare-confirm)"/);
 assert.equal(p.primaryAttackerId,null);assert.doesNotMatch(h.mapHtml(),/combat-attacker-(?:primary|selected|eligible)/);
});

test('UX2.1 target → friendly counter adds, second tap removes; primary survives sorted IDs',()=>{
 const {s,p,h}=setup();target(h);const before=JSON.stringify(s.state);
 assert.deepEqual(eligibleAdditionalAttackerIds(s,p),['a-infantry','b-jager']);
 h.click('[data-unit-id="a-infantry"]');assert.deepEqual(p.attackUnitIds,['a-infantry','z-primary']);
 assert.equal(p.primaryAttackerId,'z-primary');assert.equal(p.selectedUnitId,'z-primary');
 h.click('[data-unit-id="a-infantry"]');assert.deepEqual(p.attackUnitIds,['z-primary']);
 h.click('[data-unit-id="z-primary"]');assert.deepEqual(p.attackUnitIds,['z-primary']);
 assert.equal(JSON.stringify(s.state),before);
});

test('UX2.1 existing expanded touch hit target follows the same toggle route',()=>{
 const {s,p,h}=setup();target(h);const before=JSON.stringify(s.state),camera=h.camera();
 h.click('[data-hit-unit-id="b-jager"]');assert.deepEqual(p.attackUnitIds,['b-jager','z-primary']);
 h.click('[data-hit-unit-id="b-jager"]');assert.deepEqual(p.attackUnitIds,['z-primary']);
 assert.equal(h.camera(),camera);assert.equal(JSON.stringify(s.state),before);
});

test('UX2.1 illegal friendly additions are rejected by Core without replacing the draft',()=>{
 const variants={far:u=>{u.hex={q:4,r:0};},used:u=>{u.hasAttacked=true;},destroyed:u=>{u.alive=false;},foreign:u=>{u.controllerId=S;},support:u=>{u.type='ARTILLERY';u.templateId='G-ARTY';},rail:u=>{u.dedicatedRailRepair=true;}};
 for(const [name,change]of Object.entries(variants)){
  const {s,p,h}=setup();target(h);change(s.state.units['a-infantry']);
  assert(validateAttackAction(s.state,s.rules,{...action(p),attackerUnitIds:[...p.attackUnitIds,'a-infantry']}).length,name);
  assert(!eligibleAdditionalAttackerIds(s,p).includes('a-infantry'),name);
  const before=JSON.stringify(s.state);intents.selectCounter(s,p,'a-infantry');
  assert.deepEqual(p.attackUnitIds,['z-primary'],name);assert.equal(p.selectedUnitId,'z-primary');assert.equal(JSON.stringify(s.state),before);
  assert.equal(p.message.key,'combat.group.unavailable');
 }
});

test('UX2.1 eligibility reflects Core supply policy and the complete selected artillery payload',()=>{
 const {s,p,h}=setup();target(h);s.state.units['a-infantry'].supplyState='OUT_OF_SUPPLY';
 const probe={...action(p),attackerUnitIds:[...p.attackUnitIds,'a-infantry'].sort()};
 assert.equal(eligibleAdditionalAttackerIds(s,p).includes('a-infantry'),validateAttackAction(s.state,s.rules,probe).length===0);
 h.click('[data-unit-id="a-infantry"]');assert.equal(deriveBrowserRenderModel(s,p).combat.attackDraft.preview.attackStrength,buildCombatContext(s.state,s.rules,action(p)).attackStrength);
 p.attackerArtilleryUnitId='missing-artillery';assert.deepEqual(eligibleAdditionalAttackerIds(s,p),[]);
 intents.selectCounter(s,p,'b-jager');assert(!p.attackUnitIds.includes('b-jager'));
});

test('UX2.1 every add/remove repaints strength, odds, shift and modifiers from Core immediately',()=>{
 setLocale('zh-CN');const {s,p,h}=setup();target(h);const original=deriveBrowserRenderModel(s,p).combat.attackDraft.preview;
 h.click('[data-unit-id="a-infantry"]');
 const combined=deriveBrowserRenderModel(s,p).combat.attackDraft.preview;
 assert.deepEqual(combined,buildCombatContext(s.state,s.rules,action(p)));
 assert(combined.attackStrength>original.attackStrength);assert.notEqual(combined.baseOdds,original.baseOdds);
 assert.notEqual(combined.modifiers.combinedArmsShift,original.modifiers.combinedArmsShift);
 assert.match(h.html(),new RegExp(`攻击总战力</span><strong>${combined.attackStrength}</strong>`));
 assert.match(h.html(),new RegExp(`战斗比 <strong>${combined.finalCRTColumnLabel}</strong>`));
 assert.match(h.html(),/攻击单位：2/);assert.match(h.html(),/步坦协同/);
 h.click('[data-remove-attacker="a-infantry"]');assert.deepEqual(deriveBrowserRenderModel(s,p).combat.attackDraft.preview,original);
 assert.match(h.html(),/攻击单位：1/);
 assert.equal(s.lastResult,null,'draft edits never dispatch Core actions');
});

test('UX2.1 compact chips remove additional units but never expose a primary delete',()=>{
 const {p,h}=setup();target(h);h.click('[data-unit-id="a-infantry"]');h.click('[data-unit-id="b-jager"]');
 const compact=h.html().split('<details class="combat-advanced">')[0];
 assert.match(compact,/data-remove-attacker="a-infantry"/);assert.match(compact,/data-remove-attacker="b-jager"/);
 assert.doesNotMatch(compact,/data-remove-attacker="z-primary"/);
 h.click('[data-remove-attacker="b-jager"]');assert.deepEqual(p.attackUnitIds,['a-infantry','z-primary']);
});

test('UX2.1 the existing advanced primary replacement keeps one primary selected',()=>{
 const {s,p,h}=setup();target(h);h.click('[data-unit-id="a-infantry"]');
 h.click('[data-attack-unit="z-primary"]');assert.deepEqual(p.attackUnitIds,['a-infantry']);
 assert.equal(p.primaryAttackerId,'a-infantry');assert.equal(p.selectedUnitId,'a-infantry');
 assert.deepEqual(deriveBrowserRenderModel(s,p).counters.filter(c=>c.selected).map(c=>c.id),['a-infantry']);
 assert.deepEqual(p.attackTarget,{q:0,r:0});assert.equal(s.lastResult,null);
});

test('UX2.1 group feedback distinguishes primary, selected, eligible and unrelated counters without covering symbols',()=>{
 setLocale('zh-CN');const {s,p,h}=setup();target(h);h.click('[data-unit-id="a-infantry"]');
 const counters=deriveBrowserRenderModel(s,p).counters,find=id=>counters.find(c=>c.id===id);
 assert.equal(find('z-primary').selected,true);assert.equal(find('z-primary').combatRole,'primary');
 assert.equal(find('a-infantry').selected,false);assert.equal(find('a-infantry').combatRole,'selected');
 assert.equal(find('b-jager').combatRole,'eligible');assert.equal(find('d').combatRole,undefined);
 const map=h.mapHtml();assert.match(map,/combat-attacker-selected/);assert.match(map,/可加入攻击/);assert.match(map,/已加入联合攻击/);
 assert.equal((map.match(/class="unit-symbol"/g)??[]).length,4);
 assert.match(map,/data-unit-id="a-infantry"[^>]*aria-pressed="true"/);
});

test('UX2.1 toggle routing activates only for an editable draft with a target; other inspect behavior remains',()=>{
 for(const mode of ['no-draft','no-target','movement','pending','privacy','other-viewer','select-mode']){
  const {s,p,h}=setup();target(h);
  if(mode==='no-draft')p.attackUnitIds=[];
  if(mode==='no-target')p.attackTarget=null;
  if(mode==='movement')s.state.phase='GERMAN_MOVEMENT';
  if(mode==='pending')s.state.pendingDecision={kind:'DEFENDER_REACTION',battleId:'pending'};
  if(mode==='privacy')p.privacyGate='PASS_TURN_TO_GERMAN';
  if(mode==='other-viewer')s.activeViewerControllerId=S;
  if(mode==='select-mode')p.interactionMode='SELECT';
  assert.deepEqual(eligibleAdditionalAttackerIds(s,p),[],mode);
  intents.selectCounter(s,p,'a-infantry');assert.equal(p.selectedUnitId,'a-infantry',mode);
  if(mode!=='no-draft')assert.deepEqual(p.attackUnitIds,['z-primary'],mode);
 }
});

test('UX2.1 map edits and chip removal preserve camera, target, terrain and GameState',()=>{
 const {s,p,h}=setup();target(h);const before=JSON.stringify(s.state),camera=h.camera(),transform=h.svg.style.transform;
 for(const selector of ['[data-unit-id="a-infantry"]','[data-hit-unit-id="b-jager"]','[data-remove-attacker="a-infantry"]']){
  h.click(selector);assert.equal(h.camera(),camera);assert.equal(h.svg.style.transform,transform);assert.equal(h.surface.style.transform,transform);assert.deepEqual(p.attackTarget,{q:0,r:0});
 }
 assert.equal(JSON.stringify(s.state),before);
});

test('UX2.1 language switch preserves selected group, primary, target, Core state, RNG and camera',ctx=>{
 const {s,p,h}=setup();target(h);h.click('[data-unit-id="a-infantry"]');h.click('[data-unit-id="b-jager"]');
 const before=JSON.stringify({state:s.state,p,camera:h.camera()});clearMissingKeys();
 ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw new Error('No RNG entropy in group or language queries');});
 const control={value:'en-US',addEventListener(_,fn){this.change=fn;},focus(){}};
 const root={querySelectorAll:q=>q==='[data-language-select]'?[control]:[],querySelector:q=>q==='[data-language-select]'?control:null};
 bindLanguageControl(root,()=>h.repaint());
 for(const locale of ['en-US','zh-CN']){control.value=locale;control.change();assert.equal(JSON.stringify({state:s.state,p,camera:h.camera()}),before);assert.match(h.html(),locale==='en-US'?/Attackers: 3/:/攻击单位：3/);formatMessage(p.message);}
 for(const key of Object.keys(enUS).filter(k=>k.startsWith('combat.group.')))assert(zhCN[key]);
 assert.deepEqual(getMissingKeys(),[]);
});

test('UX2.1 artillery stays in advanced options and retains its existing Core support payload',async()=>{
 const {s,p}=fixture(17,[...groupUnits(),unit('art','G-ARTY','GERMAN','ARTILLERY',{q:-1,r:1})]),h=combatDom(s,p);target(h);
 assert(!eligibleAdditionalAttackerIds(s,p).includes('art'));
 assert.doesNotMatch(h.html().split('<details class="combat-advanced">')[0],/data-attack-artillery/);
 assert.match(h.html(),/data-attack-artillery="art"/);h.click('[data-attack-artillery="art"]');
 h.click('[data-unit-id="a-infantry"]');h.click('#attack-declare');await h.paint();
 const attack=s.state.actionLog.find(e=>e.action.type==='ATTACK');assert(attack.accepted);assert.equal(attack.action.support.attackerArtilleryUnitId,'art');
});

test('UX2.1 three-unit map attack submits canonical ATTACK and exactly matches frozen UX2 GameState/RNG',async()=>{
 const baseline=JSON.parse(readFileSync(new URL('fixtures/combat-ux21-baseline.json',import.meta.url),'utf8'));
 assert.equal(baseline.commit,'e83b544eaaf20be3b3afeee6bd449eb9c6945844');
 for(const expected of baseline.cases){
  const {s,p,h}=setup(expected.seed);let clicks=0;
  for(const selector of ['[data-unit-id="z-primary"]','[data-unit-id="d"]','[data-unit-id="a-infantry"]','[data-unit-id="b-jager"]','#attack-declare']){h.click(selector);clicks++;}
  await h.paint();assert.equal(clicks,5);
  const attack=s.state.actionLog.find(e=>e.action.type==='ATTACK');assert(attack.accepted);
  assert.deepEqual(attack.action,{type:'ATTACK',controllerId:G,attackerUnitIds:['a-infantry','b-jager','z-primary'],target:{q:0,r:0},actionId:'A-000001',battleId:'B-000001'});
  assert.deepEqual(s.state.random,expected.random);
  assert.equal(createHash('sha256').update(JSON.stringify(s.state)).digest('hex'),expected.gameStateSha256,`baseline seed ${expected.seed}`);
 }
});

test('UX2.1 production 640-hex map accepts three-unit attack through five UI taps with clean integrity',async()=>{
 const {productionFixture}=await import('./helpers/combat-fixture.mjs');
 const {s,p}=await productionFixture(17,{'G-I-01':'2,-1','G-J-01':'2,0'}),h=combatDom(s,p),camera=h.camera();
 for(const selector of ['[data-unit-id="G-PZ-01"]','[data-unit-id="S-I-01"]','[data-hit-unit-id="G-I-01"]','[data-unit-id="G-J-01"]','#attack-declare'])h.click(selector);
 await h.paint();const attack=s.state.actionLog.find(e=>e.action.type==='ATTACK');
 assert(attack?.accepted);assert.deepEqual(attack.action.attackerUnitIds,['G-I-01','G-J-01','G-PZ-01']);
 assert.equal(s.integrityIssues.length,0);assert.equal(h.camera(),camera);
});
