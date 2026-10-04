import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { legalStart } from './fixture.mjs';
import { eligibility, enabled, setEnabled, autoTicket, runAuto, commandTicket } from './flow.js';
import { dispatchGameAction, controllerIdForSide, sessionPlayerView } from '../../app/core-adapter/session.js';
import { readyForPhase, confirmPrivacyGate, recoverSelectedUnit, entrenchSelectedUnit } from '../../app/interaction/intents.js';
import { createPresentationState } from '../../app/state/presentation.js';
import { validateRecoveryAction, validateEntrenchAction, validateMoveAction, getNeighbors, computeRecoveryBaseHexKeys, validateGameStateIntegrity } from '../../app/core-adapter/core.js';
const map = JSON.parse(fs.readFileSync(new URL('../../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const start = legalStart(map);
assert.equal(Object.keys(start.state.hexes).length,640);
assert.deepEqual(validateGameStateIntegrity(start.state,start.rules,start.scenario),[]);
function fresh() {const s=legalStart(map);return {s,p:createPresentationState()};}
export function businessAction(s) {
    const own=Object.values(s.state.units).filter(u=>u.alive && u.controllerId===s.activeViewerControllerId);
    if(s.state.phase.endsWith('_MOVEMENT')) {
        for(const u of own) for(const hex of getNeighbors(u.hex)) {
            const a={type:'MOVE',controllerId:s.activeViewerControllerId,unitId:u.id,path:[hex]};
            if(!validateMoveAction(s.state,s.rules,a).issues.length) return a;
        }
    }
    if(s.state.phase.endsWith('_ENTRENCHMENT')) for(const u of own) {
        const a={type:'ENTRENCH',controllerId:s.activeViewerControllerId,unitId:u.id};
        if(!validateEntrenchAction(s.state,s.rules,s.scenario,a).length)return a;
    }
    return null;
}
function run(streamlined) {
    const {s,p}=fresh(), initialLog=s.state.actionLog.length;
    let humanEnds=0, automaticEnds=0, business=0, handoffs=0;const trace=[];
    for(let i=0;i<10;i++) {
        const phase=s.state.phase, action=businessAction(s);
        if(action){assert.equal(dispatchGameAction(s,action).result.accepted,true);business++;}
        if(streamlined)setEnabled(s,true); // Separate explicit opt-in for each side.
        const ticket=autoTicket(s,p);
        if(ticket){assert.equal(runAuto(s,p,ticket,readyForPhase),true);automaticEnds++;}
        else{readyForPhase(s,p);humanEnds++;}
        assert.equal(s.lastResult.accepted,true);
        trace.push({phase,business:action,ready:ticket?'automatic':'manual',nextPhase:s.state.phase});
        if(p.privacyGate){handoffs++;confirmPrivacyGate(s,p);}
    }
    assert.equal(s.state.turn,2);assert.equal(s.state.phase,'GERMAN_SUPPLY_RAIL');
    return {state:s.state,trace,metrics:{humanEnds,automaticEnds,business,handoffs,coreActions:s.state.actionLog.length-initialLog,businessNetworkRequests:0}};
}
const original=run(false), streamlined=run(true);
assert.deepEqual(streamlined.state,original.state);
assert.equal(original.metrics.humanEnds-streamlined.metrics.humanEnds,2);
const checks=[];
function check(name, fn){fn();checks.push({name,kind:'SYNTHETIC',result:'PASS'});}
function recovery() {const x=fresh();for(let i=0;i<3;i++)readyForPhase(x.s,x.p);return x;}
check('Default off; stale auto ticket, off switch and duplicate dispatch stop',()=>{
    const {s,p}=recovery();assert.equal(enabled(s),false);setEnabled(s,true);const old=autoTicket(s,p);
    setEnabled(s,false);assert.equal(runAuto(s,p,old,readyForPhase),false);
    setEnabled(s,true);const t=autoTicket(s,p);const n=s.state.actionLog.length;
    assert.equal(runAuto(s,p,t,readyForPhase),true);assert.equal(runAuto(s,p,t,readyForPhase),false);assert.equal(s.state.actionLog.length,n+1);
});
check('Unknown industry and pending requests stop; no non-recovery phase auto passes',()=>{
    const {s,p}=recovery();s.state={...s.state,extensions:{industry:{expiryChoice:true}}};assert.equal(eligibility(s,p).ok,false);
    delete s.state.extensions;s.pendingRequest={};assert.equal(eligibility(s,p).ok,false);delete s.pendingRequest;
    for(const phase of ['GERMAN_SUPPLY_RAIL','GERMAN_MOVEMENT','GERMAN_COMBAT','SOVIET_REINFORCEMENT_SUPPLY','GERMAN_ENTRENCHMENT']){s.state={...s.state,phase};assert.equal(eligibility(s,p).ok,false);}
});
check('Pending battle and privacy handoff stop',()=>{
    const {s,p}=recovery();s.state={...s.state,pendingDecision:{kind:'LOSS_ALLOCATION',side:'GERMAN'}};assert.equal(eligibility(s,p).ok,false);
    s.state={...s.state,pendingDecision:null};p.privacyGate='PASS_TURN_TO_GERMAN';assert.equal(eligibility(s,p).ok,false);
});
check('Only current controller ready; unready teammate still blocks Core transition',()=>{
    const {s,p}=recovery();s.state=structuredClone(s.state);s.state.controllers['G-TEAM']={...s.state.controllers[s.activeViewerControllerId],id:'G-TEAM'};
    Object.values(s.state.units).find(u=>u.side==='GERMAN').controllerId='G-TEAM';
    setEnabled(s,true);const t=autoTicket(s,p);assert.ok(t);assert.equal(runAuto(s,p,t,readyForPhase),true);
    assert.equal(s.state.phase,'GERMAN_RECOVERY');assert.deepEqual(s.state.phaseReadyControllerIds,[s.activeViewerControllerId]);assert.equal(autoTicket(s,p),null);
});
check('Legal recovery retained; recovery fee charged once; stale and repeated commands stopped',()=>{
    const {s,p}=recovery();s.state=structuredClone(s.state);
    s.state.phase='SOVIET_RECOVERY';s.state.activeSide='SOVIET';s.activeViewerControllerId=controllerIdForSide(s,'SOVIET');
    const base=computeRecoveryBaseHexKeys(s.state,'SOVIET',s.scenario)[0];assert.ok(base);
    let target;
    for(const u of Object.values(s.state.units).filter(u=>u.side==='SOVIET')){
        u.step=1;u.supplyState='SUPPLIED';u.hex={...s.state.hexes[base].coord};const a={type:'REPAIR_UNIT',controllerId:s.activeViewerControllerId,unitId:u.id};
        if(!validateRecoveryAction(s.state,s.rules,s.scenario,a).length){target=u;break;}u.step=0;
    }
    assert.ok(target,'fixture must contain a truly legal repair');assert.equal(eligibility(s,p).ok,false);p.selectedUnitId=target.id;
    const cost=s.rules.unitTemplates[target.templateId].recoveryCostPerStep, before=s.state.rp.SOVIET;
    const old=commandTicket(s,p,recoverSelectedUnit);s.state=structuredClone(s.state);assert.equal(old(),false);assert.equal(s.state.rp.SOVIET,before);
    const repair=commandTicket(s,p,recoverSelectedUnit);assert.equal(repair(),true);assert.equal(s.lastResult.accepted,true);assert.equal(s.state.rp.SOVIET,before-cost);
    assert.equal(repair(),false);setEnabled(s,true);const queued=autoTicket(s,p);const rejected=commandTicket(s,p,recoverSelectedUnit);rejected();assert.equal(enabled(s),false);assert.equal(runAuto(s,p,queued,readyForPhase),false);assert.equal(s.lastResult.accepted,false);assert.equal(rejected(),false);assert.equal(s.state.rp.SOVIET,before-cost);
    const entrench=commandTicket(s,p,entrenchSelectedUnit);entrench();assert.equal(s.lastResult.accepted,false);assert.equal(s.state.units[target.id].entrenched,false);
});
check('Hidden enemy changes do not affect empty-recovery verdict',()=>{
    const {s,p}=recovery();assert.equal(eligibility(s,p).ok,true);
    const unseen=Object.values(s.state.units).find(u=>u.side==='SOVIET'&&!sessionPlayerView(s).units.some(v=>v.id===u.id));assert.ok(unseen);
    s.state=structuredClone(s.state);s.state.units[unseen.id].step=1;
    assert.equal(eligibility(s,p).ok,true);
});
const result={baseline:JSON.parse(fs.readFileSync(new URL('./BASELINES.json',import.meta.url))).frontendCommit,seed:17001,mapHexes:640,legalDeploymentUnits:Object.keys(start.state.units).length,setupCoreActions:start.state.actionLog.length,startStateSHA256:hash(start.state),original:{metrics:original.metrics,trace:original.trace},streamlined:{metrics:streamlined.metrics,trace:streamlined.trace},equality:{fullStateIncludingActionLog:true,sha256:hash(original.state),resources:original.state.rp,cp:original.state.cp,recoveries:original.state.actionLog.filter(x=>x.action.type==='REPAIR_UNIT'&&x.accepted).length,reinforcements:original.state.actionLog.filter(x=>x.action.type==='DEPLOY_REINFORCEMENT'&&x.accepted).length,victory:original.state.victory,rng:original.state.random},checks,limits:['No combat business choices in the paired run; pending-battle guard tested synthetically.','No cross-phase plan: stale single-phase commands tested, not an atomic plan.','Local Core only; no live multiplayer or industry execution tested.']};
fs.mkdirSync(new URL('./evidence/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./evidence/comparison.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(new URL('./evidence/final-state.json',import.meta.url),JSON.stringify(original.state)+'\n');
console.log(JSON.stringify(result,null,2));
