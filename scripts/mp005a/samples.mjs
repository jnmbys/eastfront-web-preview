/** One controlled in-memory sample group. No public sockets, room codes or tokens are persisted. */
import assert from 'node:assert/strict';
import {gameHarness,production,checkSnapshot} from '../../tests/helpers/mp002.mjs';
import {fixture,unit,ordinary} from '../../tests/helpers/combat-fixture.mjs';
import {deploymentHexKeysForSide,getNeighbors,validateMoveAction} from '../../.server-dist/src/core-adapter/core.js';
import {verifyAliases,encodeProposal,decodeProposal} from './inline-view-proposal.mjs';
const coord=k=>{const [q,r]=k.split(',').map(Number);return {q,r};};

export function collectSamples(){
  const samples=[],counts={acceptedActions:0,checks:0,queryMessages:0};
  const capture=(h,label,actor=null)=>{
    for(const p of [h.a,h.b]){
      const message=p.last('PLAYER_VIEW_SNAPSHOT');
      verifyAliases(message);
      const rebuilt=decodeProposal(JSON.parse(JSON.stringify(encodeProposal(message))));
      assert.deepEqual(rebuilt,message);
      checkSnapshot(h.match,p,message.payload);checkSnapshot(h.match,p,rebuilt.payload);
      // Privacy test also rejects unplaced opposing roster IDs in hidden setup.
      if(message.payload.view.phase.endsWith('_DEPLOYMENT')){
        for(const u of h.match.authoritative.scenario.deployment.units.filter(u=>u.side!==message.payload.view.viewer)){
          assert(!JSON.stringify(message).includes(JSON.stringify(u.id)));
          assert(!JSON.stringify(rebuilt).includes(JSON.stringify(u.id)));
        }
      }
      samples.push({label,role:actor===null?'initial':p===actor?'actor':'waiting',message});counts.checks++;
    }
  };
  const apply=(h,p,action,label)=>{
    const before=h.match.matchRevision,indices=[h.a.messages.length,h.b.messages.length];
    const reply=h.submit(p,action);
    assert.equal(reply.messageType,'ACTION_ACCEPTED');assert.equal(h.match.matchRevision,before+1);
    for(const [i,peer] of [h.a,h.b].entries()){
      const sent=peer.messages.slice(indices[i]);
      assert.equal(sent.filter(m=>m.messageType==='PLAYER_VIEW_SNAPSHOT').length,1);
      counts.queryMessages+=sent.filter(m=>m.messageType==='MATCH_QUERY').length;
      assert.equal(peer.last('PLAYER_VIEW_SNAPSHOT').payload.matchRevision,before+1);
    }
    counts.acceptedActions++;capture(h,label,p);
  };
  const h=gameHarness(()=>production(17));capture(h,'production-initial');
  for(const [side,p,special] of [['SOVIET',h.b,{'S-I-01':'3,-1'}],['GERMAN',h.a,{'G-PZ-01':'2,-1','G-I-01':'2,-1','G-J-01':'2,0'}]]){
    const s=h.match.authoritative,zone=deploymentHexKeysForSide(s.state,s.scenario,side),occupancy={};
    const roster=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort();
    for(const [id,k] of Object.entries(special)){
      apply(h,p,{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:coord(k)},`${side}-deployment`);occupancy[k]=(occupancy[k]??0)+1;
    }
    for(const id of roster){if(id in special)continue;
      const k=zone.find(k=>(occupancy[k]??0)<2&&!Object.values(special).includes(k));assert(k);
      apply(h,p,{type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:id,hex:coord(k)},`${side}-deployment`);occupancy[k]=(occupancy[k]??0)+1;
    }
    apply(h,p,{type:'READY_FOR_PHASE_END'},`${side}-deployment-end`);
  }
  assert.equal(h.match.authoritative.state.phase,'GERMAN_SUPPLY_RAIL');
  apply(h,h.a,{type:'READY_FOR_PHASE_END'},'production-movement-entry');
  const s=h.match.authoritative;let move;
  for(const u of Object.values(s.state.units).filter(u=>u.side==='GERMAN'&&!['G-PZ-01','G-I-01','G-J-01'].includes(u.id))){
    for(const hex of getNeighbors(u.hex))if(!validateMoveAction(s.state,s.rules,{type:'MOVE',controllerId:u.controllerId,unitId:u.id,path:[hex]}).issues.length){move={type:'MOVE',unitId:u.id,path:[hex]};break;}
    if(move)break;
  }
  assert(move);apply(h,h.a,move,'production-move');
  apply(h,h.a,{type:'READY_FOR_PHASE_END'},'production-combat-entry');
  apply(h,h.a,{type:'ATTACK',attackerUnitIds:['G-PZ-01','G-I-01','G-J-01'],target:{q:3,r:-1}},'production-attack');
  apply(h,h.b,{type:'PASS_REACTION',battleId:s.state.pendingDecision.battleId},'production-reaction');
  // A recovery snapshot of the CURRENT view is sufficient; no baseline/delta cache.
  h.a.send('RESYNC_MATCH',{matchId:h.match.matchId});h.b.send('RESYNC_MATCH',{matchId:h.match.matchId});
  capture(h,'production-resync');

  // Targeted non-deployment counterexamples: observation loss and private artillery.
  const fog=gameHarness(()=>{const s=fixture(17,[unit('recon','G-RECON','GERMAN','RECON',{q:0,r:0}),unit('enemy','S-INF','SOVIET','INFANTRY',{q:3,r:0})]).s;s.state.phase='GERMAN_MOVEMENT';s.state.hexes['2,0'].control='SOVIET';return s;});
  capture(fog,'contact-before');
  apply(fog,fog.a,{type:'MOVE',unitId:'recon',path:[{q:-1,r:0}]},'last-known-after');
  assert.equal(fog.a.last('PLAYER_VIEW_SNAPSHOT').payload.view.lastKnown.length,1);
  const beforeFog=samples.find(s=>s.label==='contact-before'&&s.message.payload.view.viewer==='GERMAN').message.payload.view;
  assert.equal(beforeFog.hexes.find(h=>h.coord.q===2&&h.coord.r===0).control,'SOVIET');
  assert.equal(fog.a.last('PLAYER_VIEW_SNAPSHOT').payload.view.hexes.find(h=>h.coord.q===2&&h.coord.r===0).control,null);
  const combat=gameHarness(()=>fixture(2722,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),unit('hidden-art','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]).s);
  apply(combat,combat.a,{type:'ATTACK',attackerUnitIds:['g','g2'],target:{q:0,r:0}},'private-reaction');
  apply(combat,combat.b,{type:'COMBAT_REACTION',battleId:combat.match.authoritative.state.pendingDecision.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'hidden-art'}},'private-artillery');
  assert(!JSON.stringify(combat.a.last('PLAYER_VIEW_SNAPSHOT')).includes('hidden-art'));
  return {samples,counts};
}
