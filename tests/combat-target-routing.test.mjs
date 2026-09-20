import {combatAttackPanel} from '../dist/app/ui/combatAttackPanel.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {RulesEngine,createGameState,defaultRules,defaultScenario} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {selectCounter,toggleAttackUnit,routeCombatTarget,isCombatTargetSelection,combatTargetIssues,declareAttack} from '../dist/app/interaction/intents.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
const G='G-HUMAN-1',S='S-AI-1';
const key=h=>`${h.q},${h.r}`;
const grid=(n=5)=>{const out=[];for(let q=-n;q<=n;q++)for(let r=-n;r<=n;r++)out.push({coord:{q,r},terrain:'PLAIN',control:null});return out;};
const unit=(id,templateId,side,type,hex)=>({id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
function fixture(units,seed=2722){const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:grid(),edges:[],units,seed});for(const u of Object.values(st.units))if(u.alive)u.supplyState='SUPPLIED';st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return {state:st,scenario:defaultScenario,rules:defaultRules,engine:new RulesEngine(defaultRules,defaultScenario),activeViewerControllerId:G,lastResult:null,integrityIssues:[]};}

function setup(){const s=fixture([unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0}),unit('far','S-INF','SOVIET','INFANTRY',{q:4,r:0})]);const p=createPresentationState();selectCounter(s,p,'g');return {s,p};}
test('normal inspect remains available outside target mode',()=>{const {s,p}=setup();s.state.phase='GERMAN_MOVEMENT';selectCounter(s,p,'d');assert.equal(p.selectedUnitId,'d');assert.equal(p.attackTarget,null);s.state.phase='GERMAN_COMBAT';p.attackUnitIds=[];selectCounter(s,p,'far');assert.equal(p.selectedUnitId,'far');assert.equal(isCombatTargetSelection(s,p),false);});
test('enemy counter routes to target without overwriting inspector or mutating GameState',()=>{const {s,p}=setup(),before=JSON.stringify(s.state);selectCounter(s,p,'d');assert.equal(p.selectedUnitId,'g');assert.deepEqual(p.attackTarget,{q:0,r:0});assert.equal(JSON.stringify(s.state),before);const m=deriveBrowserRenderModel(s,p);assert.deepEqual(m.combat.attackDraft.target,{q:0,r:0});assert.equal(m.combat.attackDraft.issues.length,0);assert(m.combat.attackDraft.preview);});
test('enemy hex follows same route; illegal enemy and empty target rejected',()=>{const {s,p}=setup();assert.equal(routeCombatTarget(s,p,{q:0,r:0}),true);const before={...p.attackTarget};selectCounter(s,p,'far');assert.deepEqual(p.attackTarget,before);assert.equal(p.selectedUnitId,'g');assert.match(p.message,/Cannot select attack target/);routeCombatTarget(s,p,{q:2,r:2});assert.deepEqual(p.attackTarget,before);assert(combatTargetIssues(s,p,{q:4,r:0}).length>0);});
test('pending decision and privacy handoff do not enter attack target routing',()=>{const {s,p}=setup();p.privacyGate='PASS_TURN_TO_GERMAN';assert.equal(routeCombatTarget(s,p,{q:0,r:0}),false);p.privacyGate=null;s.state.pendingDecision={kind:'DEFENDER_REACTION',battleId:'pending'};assert.equal(isCombatTargetSelection(s,p),false);});
test('declare requires target; valid target uses existing Core ATTACK dispatch',()=>{const {s,p}=setup(),before=JSON.stringify(s.state);declareAttack(s,p);assert.equal(s.lastResult,null);assert.equal(JSON.stringify(s.state),before);selectCounter(s,p,'d');declareAttack(s,p);assert.equal(s.lastResult.accepted,true);assert.equal(s.lastResult.action.type,'ATTACK');});
const main=readFileSync(new URL('../dist/app/main.js',import.meta.url),'utf8');
test('target panel disables declaration until valid and displays selected coordinates',()=>{const {s,p}=setup();const ctx=vm.createContext({combatAttackPanel,esc:x=>x,coreHexKey:h=>`${h.q},${h.r}`,combatContextHtml:()=>'',issueHtml:()=>'',battleHistoryHtml:()=>''});const start=main.indexOf('function combatPanel(');const end=main.indexOf('function phasePanel(',start);vm.runInContext(main.slice(start,end),ctx);let html=ctx.combatPanel(deriveBrowserRenderModel(s,p));assert.match(html,/id="attack-declare"[^>]*disabled/);selectCounter(s,p,'d');html=ctx.combatPanel(deriveBrowserRenderModel(s,p));assert.doesNotMatch(html,/id="attack-declare"[^>]*disabled/);assert.match(html,/<span>Target<\/span><strong>0,0/);});
test('feedback marks legal enemies and selected target, excludes illegal enemies',()=>{const {s,p}=setup();selectCounter(s,p,'d');const el=(hex,role)=>({dataset:{hex,role},classes:new Set(),classList:{toggle(k,v){v?this.owner.classes.add(k):this.owner.classes.delete(k);}},setAttribute(){}});const nodes=[el('0,0'),el('4,0'),el('0,0','attack-target')];for(const n of nodes)n.classList.owner=n;const ctx=vm.createContext({session:s,presentation:p,isCombatTargetSelection,combatTargetIssues,coreHexKey:h=>`${h.q},${h.r}`,document:{querySelectorAll:()=>nodes}});vm.runInContext(main.slice(main.indexOf('function paintCombatTargets('),main.indexOf('function bindDynamic(')),ctx);ctx.paintCombatTargets();assert(nodes[0].classes.has('attackable-enemy'));assert(nodes[0].classes.has('selected-combat-target'));assert(!nodes[1].classes.has('attackable-enemy'));assert(nodes[2].classes.has('selected-combat-target'));});


test('single attacker auto-selection is legal, non-mutating, and matches manual ATTACK outcome',()=>{
 const {s,p}=setup();assert.deepEqual(p.attackUnitIds,['g']);const manual=setup();manual.p.attackUnitIds=[];toggleAttackUnit(manual.s,manual.p,'g');
 selectCounter(s,p,'d');routeCombatTarget(manual.s,manual.p,{q:0,r:0});declareAttack(s,p);declareAttack(manual.s,manual.p);
 assert.equal(s.lastResult.accepted,true);assert.deepEqual(s.state,manual.s.state);
});
test('advanced multi attacker selection preserves existing attackers and dispatches combined attack',()=>{
 const {s,p}=setup();s.state.units.g2=unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1});selectCounter(s,p,'d');
 selectCounter(s,p,'g2');assert.deepEqual(p.attackUnitIds,['g']);toggleAttackUnit(s,p,'g2');assert.deepEqual(p.attackUnitIds,['g','g2']);
 assert.equal(deriveBrowserRenderModel(s,p).combat.attackDraft.issues.length,0);declareAttack(s,p);assert.equal(s.lastResult.accepted,true);assert.deepEqual(s.lastResult.action.attackerUnitIds,['g','g2']);
});
test('unavailable attacker is not automatically selected and basic preview keeps advanced controls collapsed',()=>{
 const {s,p}=setup();p.attackUnitIds=[];s.state.units.g.hasAttacked=true;selectCounter(s,p,'g');assert.deepEqual(p.attackUnitIds,[]);
 const h=combatAttackPanel(deriveBrowserRenderModel(s,p),'');assert.match(h,/id="attack-declare"[^>]*disabled/);assert.doesNotMatch(h,/<details[^>]*\sopen/);assert.match(h,/Add supporting units/);
});
