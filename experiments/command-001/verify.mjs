import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { commandStart,SCENE,SEED } from './fixture.mjs';
import * as command from './command.js';
import { dispatchGameAction,sessionPlayerView } from '../../app/core-adapter/session.js';
import { deriveBrowserRenderModel } from '../../app/core-adapter/browserProjection.js';
import { createPresentationState } from '../../app/state/presentation.js';
import * as i from '../../app/interaction/intents.js';
import * as f from '../../app/interaction/combatFlow.js';
import { validateGameStateIntegrity } from '../../app/core-adapter/core.js';
const map=JSON.parse(fs.readFileSync(new URL('../../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url)));
const hash=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const evidence=new URL('./evidence/',import.meta.url);fs.mkdirSync(evidence,{recursive:true});
function replay(withPlan){
    const s=commandStart(map),p=createPresentationState(),start=structuredClone(s.state);
    assert.equal(Object.keys(s.state.hexes).length,640);assert.deepEqual(s.integrityIssues,[]);
    command.observe(s,()=>({viewer:s.activeViewerControllerId,view:sessionPlayerView(s)}));
    const model=()=>deriveBrowserRenderModel(s,p),plan=command.scope(s,s.activeViewerControllerId);
    if(withPlan){const before=hash(s.state);command.toggleMember(plan,model(),SCENE.mover);command.toggleMember(plan,model(),SCENE.supporter);plan.picking='target';command.mark(plan,model(),SCENE.target);assert.equal(hash(s.state),before);}
    assert.equal(dispatchGameAction(s,{type:'MOVE',controllerId:s.activeViewerControllerId,unitId:SCENE.mover,path:[SCENE.move]}).result.accepted,true);
    i.readyForPhase(s,p);i.selectCounter(s,p,SCENE.mover);i.routeCombatTarget(s,p,SCENE.target);i.attackAndContinue(s,p);
    assert.equal(s.state.pendingDecision?.kind,'RETREAT');assert.equal(Object.values(s.state.combatTransactions)[0].resolution.crtResult,'AR');
    const choices=f.retreatPlan(s,p).options;assert.deepEqual(choices[0],{q:2,r:3});
    if(withPlan){assert.equal(command.toggleMember(plan,model(),SCENE.supporter),false);plan.picking='target';assert.equal(command.mark(plan,model(),{q:4,r:4}),false);plan.picking=null;}
    f.chooseRetreatDestination(s,p,choices[0]);assert.equal(s.state.pendingDecision,null);
    i.selectCounter(s,p,SCENE.supporter);i.routeCombatTarget(s,p,SCENE.target);i.attackAndContinue(s,p);
    assert.equal(s.state.pendingDecision?.kind,'RETREAT');const secondRetreat=f.retreatPlan(s,p).options[0];f.chooseRetreatDestination(s,p,secondRetreat);assert.equal(s.state.pendingDecision,null);
    assert.deepEqual(validateGameStateIntegrity(s.state,s.rules,s.scenario),[]);
    if(withPlan){assert.deepEqual(plan.target,SCENE.target);assert.deepEqual(plan.members,[SCENE.mover,SCENE.supporter]);}
    return {s,p,start,plan,secondRetreat};
}
const original=replay(false),candidate=replay(true);assert.deepEqual(original.s.state,candidate.s.state);
const checks=[];
function check(name,fn){fn();checks.push({name,kind:'SYNTHETIC',result:'PASS'});}
check('Enemy membership rejected; pending choices never interpreted as a plan command',()=>{
    const m=deriveBrowserRenderModel(candidate.s,candidate.p),p=candidate.plan;assert.equal(command.toggleMember(p,m,SCENE.defender),false);
    const pending={...m,combat:{...m.combat,pending:{kind:'LOSS_ALLOCATION'}}};p.picking='target';assert.equal(command.mark(p,pending,SCENE.target),false);p.picking=null;
});
check('Plans isolated by controller and session; persist across phase/turn metadata changes',()=>{
    const a=command.scope(candidate.s,'G-HUMAN-1'),b=command.scope(candidate.s,'S-AI-1');assert.equal(b.target,null);assert.deepEqual(a.target,SCENE.target);assert.equal(command.scope({},'G-HUMAN-1').target,null);
    const m=deriveBrowserRenderModel(candidate.s,candidate.p);command.panel(candidate.s,{...m,turn:10,phase:'GERMAN_RECOVERY'});assert.deepEqual(a.target,SCENE.target);
});
check('Unknown control remains absent; missing enemy is not reported destroyed; UI never reads GameState',()=>{
    const guarded=new Proxy({}, {get(){throw new Error('No canonical state access permitted');}});
    const m=deriveBrowserRenderModel(candidate.s,candidate.p);
    const safe={...m,hexes:[{coord:{q:0,r:0},control:null}],playerView:{...m.playerView,units:[],hexes:[{coord:{q:0,r:0},control:null}]},selectedCounter:null};
    assert.ok(!command.overlay(guarded,safe).includes('<polygon'));assert.ok(!command.summary(guarded,safe).includes('被消灭'));command.panel(guarded,safe);
});
check('Synthetic 4:1 combat: actual Core loss/retreat/advance events stay with the authorized viewer',()=>{
    const s=commandStart(map),p=createPresentationState();s.state=structuredClone(s.state);
    // Explicitly synthetic repositioning of existing friendly units, not part of the playable replay.
    s.state.phase='GERMAN_COMBAT';for(const id of ['G-I-01','G-I-03','G-I-04'])s.state.units[id].hex={...SCENE.move};
    command.observe(s,()=>({viewer:s.activeViewerControllerId,view:sessionPlayerView(s)}));
    i.selectCounter(s,p,'G-I-01');i.routeCombatTarget(s,p,SCENE.target);
    for(const id of ['G-I-02','G-I-03','G-I-04'])i.toggleSupportingAttacker(s,p,id);
    i.attackAndContinue(s,p);assert.equal(s.state.pendingDecision.kind,'RETREAT');
    assert.equal(Object.values(s.state.combatTransactions)[0].resolution.crtResult,'D1R');
    assert.equal(s.state.units['S-I-01'].step,1); // Core applies the forced single-unit loss before the retreat choice.
    assert.equal(s.state.pendingDecision.kind,'RETREAT');f.chooseRetreatDestination(s,p,f.retreatPlan(s,p).options[0]);
    assert.equal(s.state.pendingDecision.kind,'ADVANCE_AFTER_COMBAT');f.chooseAdvancer(s,p,'G-I-01');f.chooseAdvanceDestination(s,p,SCENE.target);
    const german=command.scope(s,'G-HUMAN-1'),soviet=command.scope(s,'S-AI-1');
    assert.ok(german.events.some(e=>e.kind==='hit'&&e.unitId==='S-I-01')); // Visible enemy loss was authorized to German at resolution.
    assert.ok(soviet.events.some(e=>e.kind==='retreat'&&e.unitId==='S-I-01'));
    assert.ok(!german.events.some(e=>e.kind==='retreat'&&e.unitId==='S-I-01')); // Do not merge the other viewer's travel history.
    assert.ok(german.events.some(e=>e.kind==='advance'&&e.unitId==='G-I-01'));
    assert.deepEqual(s.state.units['G-I-01'].hex,SCENE.target);
});
const battle=Object.values(candidate.s.state.combatTransactions)[0];
const result={frontendBaseline:'2be91365c0f65075ab20f5f77b9dd30855d96558',seed:SEED,mapHexes:640,start:{turn:9,phase:original.start.phase,acceptedReplayActions:original.start.actionLog.length,sha256:hash(original.start),reinforcementDeployments:original.start.actionLog.filter(x=>x.action.type==='DEPLOY_REINFORCEMENT').length},business:{move:SCENE.move,separateAttacks:[SCENE.mover,SCENE.supporter],target:SCENE.target,retreats:[{q:2,r:3},candidate.secondRetreat]},results:Object.values(candidate.s.state.combatTransactions).map(b=>b.resolution),fullStateEqual:true,finalStateSHA256:hash(candidate.s.state),coreActions:candidate.s.state.actionLog.slice(original.start.actionLog.length).map(x=>x.action),resources:{rp:candidate.s.state.rp,cp:candidate.s.state.cp},rng:candidate.s.state.random,victory:candidate.s.state.victory,checks};
fs.writeFileSync(new URL('rules-comparison.json',evidence),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(new URL('start-state.json',evidence),JSON.stringify(original.start)+'\n');
fs.writeFileSync(new URL('final-state.json',evidence),JSON.stringify(original.s.state)+'\n');
fs.writeFileSync(new URL('setup-actions.json',evidence),JSON.stringify(original.start.actionLog.map(e=>e.action),null,2)+'\n');
console.log(JSON.stringify(result,null,2));
