import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CombatResults,combatResults} from '../dist/app/ui/combatResult.js';
import {publishAuthorizedEvents} from '../dist/app/presentation/transitionBus.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {setLocale} from '../dist/app/localization/index.js';
import {fixture,ordinary,unit,G,S} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import {selectCounter,attackAndContinue} from '../dist/app/interaction/intents.js';
const model=(s,p)=>deriveBrowserRenderModel(s,p);
const resultEvent=id=>({id:id+':result',actionId:id,kind:'combat-result',battleId:id,unitIds:[],attackers:[]});
function resolved(seed=2722){const f=fixture(seed);selectCounter(f.s,f.p,'g');selectCounter(f.s,f.p,'d');attackAndContinue(f.s,f.p);return {...f,m:model(f.s,f.p)};}
test('UX3 actual buttons show waiting before dispatch, authorized dice persist and history never replays or mutates RNG',async()=>{
 setLocale('zh-CN');const {s,p}=fixture(),h=combatDom(s,p);h.click('[data-unit-id="g"]');h.click('[data-unit-id="d"]');const before=JSON.stringify(s.state);const button=h.click('#attack-declare');assert.match(button.textContent,/等待结算/);assert.equal(JSON.stringify(s.state),before);button.fire('click');await h.paint();
 const tx=Object.values(s.state.combatTransactions)[0];assert.equal(Object.keys(s.state.combatTransactions).length,1);
 assert.match(h.html(),new RegExp('骰子 '+tx.resolution.dice.die1+' \\+ '+tx.resolution.dice.die2+' = '+tx.resolution.dice.total));assert.match(h.html(),new RegExp(tx.resolution.crtResult));assert.match(h.html(),/CRT 列修正/);
 const after=JSON.stringify(s.state);h.click('#result-close');assert.doesNotMatch(h.html(),/data-result-battle=/);h.click('[data-result-history="'+tx.battleId+'"]');assert.match(h.html(),/data-result-battle=/);assert.doesNotMatch(h.html(),/dice-reveal/);assert.equal(JSON.stringify(s.state),after);
});
test('UX3 new authorized event animates once; duplicate, history, refresh bootstrap, resync and reduced motion are static',()=>{
 const {m}=resolved(),id=m.combat.battle.battleId,key={},r=new CombatResults(key);r.html({...m,combat:null});publishAuthorizedEvents(key,[resultEvent(id)]);assert.match(r.html(m),/dice-reveal/);publishAuthorizedEvents(key,[resultEvent(id)]);assert.doesNotMatch(r.html(m),/dice-reveal/);r.open(id);assert.doesNotMatch(r.html(m),/dice-reveal/);
 const fresh=new CombatResults({});assert.doesNotMatch(fresh.html(m),/dice-reveal/);
 const reconnectKey={},reconnect=new CombatResults(reconnectKey);reconnect.html({...m,combat:null});publishAuthorizedEvents(reconnectKey,[resultEvent(id)]);reconnect.recover();assert.doesNotMatch(reconnect.html(m),/dice-reveal/);
 const reducedKey={},reduced=new CombatResults(reducedKey);reduced.html({...m,combat:null});publishAuthorizedEvents(reducedKey,[resultEvent(id)]);assert.doesNotMatch(reduced.html(m,true),/dice-reveal/);assert.doesNotMatch(reduced.html(m,false),/dice-reveal/);
});
test('UX3 viewer isolation and absent authorized model never synthesize dice or use another viewer cache',()=>{
 const {m}=resolved(),r=new CombatResults({});r.html(m);const hidden={...m,viewerControllerId:'other',combat:null,readOnly:true};assert.equal(r.html(hidden),'');r.open(m.combat.battle.battleId);const html=r.html(hidden);assert.match(html,/未获授权/);assert.doesNotMatch(html,/class="die"/);assert.match(r.html(m),/class="die"/);
});
test('UX3 a new pending battle hides old result; later consecutive result matches its own ID and details',()=>{
 const {m}=resolved(),r=new CombatResults({});r.html(m);r.begin();let html=r.html(m);assert.match(html,/等待结算/);assert.doesNotMatch(html,/class="die"/);
 const next=structuredClone(m);next.combat.battle.battleId='second';next.combat.battle.resolution=null;next.combat.pending={battleId:'second',kind:'DEFENDER_REACTION'};assert.match(r.html(next),/等待结算/);
 next.combat.battle.resolution=structuredClone(m.combat.battle.resolution);next.combat.battle.resolution.dice={die1:1,die2:6,total:7};next.combat.pending=null;html=r.html(next);assert.match(html,/data-result-battle="second"/);assert.match(html,/骰子 1 \+ 6 = 7/);r.close();assert.doesNotMatch(r.html(next),/data-result-battle=/);
});
test('UX3 pending consequences use actual requirement fields, not an invented completed loss ledger',()=>{
 const {m}=resolved(),r=new CombatResults({}),pending=structuredClone(m);pending.combat.battle.stage='AWAITING_LOSS_ALLOCATION';pending.combat.pending={battleId:m.combat.battle.battleId,kind:'LOSS_ALLOCATION'};const html=r.html(pending);assert.match(html,/待处理/);assert.match(html,/未提供逐单位实际损失/);assert.doesNotMatch(html,/后续流程已结束/);
});
test('UX3 multi-attacker UI result is identical to Core and remains closable during follow-up choices',async()=>{
 const {s,p}=fixture(17,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1})]);const h=combatDom(s,p);h.click('[data-unit-id="g"]');h.click('[data-unit-id="d"]');h.click('[data-unit-id="g2"]');h.click('#attack-declare');await h.paint();const tx=Object.values(s.state.combatTransactions)[0];assert.equal(tx.attackerUnitIds.length,2);const m=model(s,p);assert.deepEqual(m.combat.battle.resolution,tx.resolution);assert.match(h.html(),/data-result-battle=/);h.click('#result-close');assert.doesNotMatch(h.html(),/data-result-battle=/);assert.match(h.html(),/phase-actions/);
});
test('UX3 bilingual results preserve dice and no modifier is labelled as dice arithmetic',()=>{
 const {m}=resolved();for(const locale of ['en-US','zh-CN']){setLocale(locale);const html=new CombatResults({}).html(m);assert.match(html,/class="die"/);assert.match(html,locale==='en-US'?/CRT column shift/:/CRT 列修正/);assert.doesNotMatch(html,/undefined|NaN/);}setLocale('zh-CN');
});
test('UX3 implementation stays within authorized DTOs, light CSS and local history controls',()=>{
 const src=readFileSync('src/ui/combatResult.ts','utf8');assert.doesNotMatch(src,/Math\.random|session\.state|\.engine\.|localStorage|sessionStorage/);
 const css=readFileSync('styles.css','utf8');assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/result-reveal \.48s/);
 const main=readFileSync('src/main.ts','utf8');assert.match(main,/button.matches\('#result-close, \[data-result-history\]'\)/);
});

test('UX3 hotseat decision-owner handoff reveals once on the first authorized result, not later on returning to attacker',()=>{
 const {m}=resolved(),key={},r=new CombatResults(key);r.html({...m,combat:null});publishAuthorizedEvents(key,[resultEvent(m.combat.battle.battleId)]);
 const defender={...m,viewerControllerId:S};assert.match(r.html(defender),/dice-reveal/);assert.doesNotMatch(r.html(m),/dice-reveal/);
});
