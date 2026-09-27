import {RulesEngine,createGameState,defaultRules,defaultScenario} from '../../dist/vendor/eastfront-digital-core/dist/index.js';
export function movementFixture(full=false){
 const unit=(id,hex)=>({id,templateId:'G-INF',side:'GERMAN',type:'INFANTRY',step:0,alive:true,hex,supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:'G-HUMAN-1',temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
 const hexes=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
 const units=[unit('mover',{q:0,r:0}),unit('friend',{q:1,r:0}),unit('far',{q:3,r:0})];
 if(full)for(let i=0;i<8;i++)units.push(unit(`stack${i}`,{q:1,r:0}));
 const state=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed:2722});state.phase='GERMAN_MOVEMENT';state.activeSide='GERMAN';
 for(const u of Object.values(state.units))u.supplyState='SUPPLIED';
 return {state,scenario:defaultScenario,rules:defaultRules,engine:new RulesEngine(defaultRules,defaultScenario),activeViewerControllerId:'G-HUMAN-1',lastResult:null,integrityIssues:[]};
}
