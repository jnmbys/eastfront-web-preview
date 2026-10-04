import { createLocalGameSession, dispatchGameAction, controllerIdForSide } from '../../app/core-adapter/session.js';
import { deploymentHexKeysForSide, getAvailableSovietReinforcements, computeLegalSovietReinforcementEntryHexKeys } from '../../app/core-adapter/core.js';
export const SEED = 17001;
export const SCENE = { mover:'G-I-01', supporter:'G-I-02', defender:'S-I-01', move:{q:2,r:4}, target:{q:3,r:4} };
// Replay, not a state editor. Every setup, reinforcement and ready action must succeed.
export function commandStart(rawMap) {
    const s=createLocalGameSession(rawMap,SEED);
    const apply=a=>{const r=dispatchGameAction(s,a);if(!r.result.accepted)throw new Error(JSON.stringify({a,issues:r.result.issues}));};
    const placements={'G-I-01':{q:1,r:4},'G-I-02':{q:2,r:5},'S-I-01':SCENE.target};
    for(const side of ['SOVIET','GERMAN']){
        s.activeViewerControllerId=controllerIdForSide(s,side);
        const hexes=deploymentHexKeysForSide(s.state,s.scenario,side).map(k=>s.state.hexes[k].coord)
            .sort((a,b)=>(side==='SOVIET'?b.q-a.q:a.q-b.q)||b.r-a.r);
        for(const u of s.scenario.deployment.units.filter(u=>u.side===side)){
            const hex=placements[u.id]??hexes.find(h=>!Object.values(placements).some(x=>x.q===h.q&&x.r===h.r)&&Object.values(s.state.units).filter(x=>x.hex.q===h.q&&x.hex.r===h.r).length<s.rules.stackingLimit);
            apply({type:'DEPLOY_INITIAL_UNIT',controllerId:s.activeViewerControllerId,deploymentUnitId:u.id,hex});
        }
        apply({type:'READY_FOR_PHASE_END',controllerId:s.activeViewerControllerId});
    }
    while(!(s.state.turn===9&&s.state.phase==='GERMAN_MOVEMENT')){
        if(s.state.phase==='GAME_OVER'||s.state.turn>9)throw new Error('Unexpected fixture termination');
        s.activeViewerControllerId=controllerIdForSide(s,s.state.activeSide);
        if(s.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
            for(const slot of getAvailableSovietReinforcements(s.state,s.scenario)){
                const entry=computeLegalSovietReinforcementEntryHexKeys(s.state,s.rules,s.scenario)[0];
                if(!entry)break;
                apply({type:'DEPLOY_REINFORCEMENT',controllerId:s.activeViewerControllerId,reinforcementId:slot.id,entryHex:s.state.hexes[entry].coord});
            }
        }
        apply({type:'READY_FOR_PHASE_END',controllerId:s.activeViewerControllerId});
    }
    s.activeViewerControllerId=controllerIdForSide(s,'GERMAN');
    return s;
}
