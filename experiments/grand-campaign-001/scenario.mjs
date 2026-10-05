import fs from 'node:fs';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
export const config=JSON.parse(fs.readFileSync(new URL('./config.json',import.meta.url),'utf8'));
export const sides=['GERMAN','SOVIET'];
export const hex=(col,row)=>core.paperToAxial(core.columnToLetters(col),row);
export const key=(col,row)=>core.hexKey(hex(col,row));
export function createScenario(){
 if(config.board.rows!==32||config.board.cols!==40||config.unitsPerSide!==config.lanes.length*12||config.recovery.initialUnderstrengthPerSide!==2)throw Error('UNSUPPORTED_SCENARIO_LAYOUT_PARAMETERS');
 const rules=structuredClone(core.defaultRules),scenario=structuredClone(core.defaultScenario);
 rules.id='grand-001-experimental';rules.recovery.initialRP={GERMAN:0,SOVIET:0};
 rules.recovery.maxUnitsPerTurn={GERMAN:config.recovery.unitsPerSidePerTurn,SOVIET:[{fromTurn:1,maxUnits:config.recovery.unitsPerSidePerTurn}]};
 for(const t of Object.values(rules.unitTemplates))t.recoveryCostPerStep=0; // P/E is checked and paid in the same outer transaction; never charge/refund RP.
 Object.assign(scenario,{id:config.id,displayName:'大战略实验战役',rulesId:rules.id,board:{paperColumns:40,paperRows:32},turnLimit:config.turns,victoryMode:"HOST_FULL_TURN",capitalCoreHexes:[hex(36,17)],capitalOuterHexes:[],reinforcements:[],initialUnits:[],controllers:sides.map(side=>({id:side,side,controllerType:'HUMAN'}))});
 // Original capital evaluator is bypassed only for this scenario. E24 VP adjudication is explicit in authority.mjs.
 scenario.germanWestRailEntries=config.lanes.map(row=>hex(3,row));scenario.sovietEastRailExits=config.lanes.map(row=>hex(38,row));scenario.sovietSupplySources=config.lanes.map(row=>hex(38,row));
 const raw={rows:32,cols:40,terrain:{},roads:[],rails:[],rivers:[]},nodes=[],roster=[],placements=[];
 for(let c=1;c<=40;c++)for(let r=1;r<=32;r++){
  let terrain=r<=8&&c%6<3?'forest':r<=7&&c%7===4?'hill':r>=22&&c%9===5?'marsh':'plain';
  raw.terrain[`${c},${r}`]=terrain;
 }
 function line(c1,r1,c2,r2,rail=true){let a=hex(c1,r1),target=hex(c2,r2);while(core.hexDistance(a,target)>0){const b=core.getNeighbors(a).filter(h=>h.q>=0&&h.q<40&&core.axialToPaper(h).row>=1&&core.axialToPaper(h).row<=32).sort((x,y)=>core.hexDistance(x,target)-core.hexDistance(y,target))[0];const cell=h=>[h.q+1,core.axialToPaper(h).row];raw.roads.push([cell(a),cell(b)]);if(rail)raw.rails.push([cell(a),cell(b)]);a=b;}}
 for(const row of config.lanes)line(1,row,40,row);
 for(const col of [3,16,24,38])line(col,2,col,31);
 for(let row=22;row<=31;row++)for(let col=19;col<=21;col++){
  const a=hex(col,row);for(const b of core.getNeighbors(a))if(b.q===col&&core.axialToPaper(b).row===row)raw.rivers.push({a:[col,row],b:[col+1,row],kind:'main'});
 }
 for(const side of sides){const west=side==='GERMAN',rear=west?3:38,front=west?16:24;
  config.lanes.forEach((row,i)=>{
   for(const [col,role]of[[rear,'industry'],[front,'depot']]){
    const id=`${side}-${role}-${i+1}`;raw.terrain[`${col},${row}`]='city';
    nodes.push({id,side,initialOwner:side,hex:key(col,row),label:`${core.columnToLetters(col)}${row}`,role,incomeI:role==='industry'?config.economy.industrialIncome:0,sourceQ:role==='industry'?config.supply.sourceQPerLane:0,vp:role==='industry'?config.victory.industryVP:config.victory.junctionVP});
   }
   for(let j=0;j<12;j++){
    const n=i*12+j,id=`${west?'G':'S'}-${String(n+1).padStart(3,'0')}`;
    const templates=west?['G-INF','G-INF','G-INF','G-INF','G-PANZER','G-MOT','G-ARTY','G-ENG','G-RECON','G-INF','G-INF','G-INF']:['S-INF','S-INF','S-INF','S-INF','S-TANK','S-MOT','S-ARTY','S-ENG','S-AT','S-INF','S-INF','S-INF'];
    const col=j<4?(west?18:21):j<8?front:(west?14:27),r=row+[-1,0,1,2][j%4];
    const position=n>=58?hex(front,row+n-58):hex(!west&&i>=3&&j===0?22:col,r);raw.terrain[`${position.q+1},${core.axialToPaper(position).row}`]=n>=58?'city':raw.terrain[`${position.q+1},${core.axialToPaper(position).row}`];
    roster.push({id,templateId:templates[j],side});placements.push({id,side,hex:position,army:`${west?'西':'东'}-${i+1}集团军`,step:n>=58?1:0});
   }
  });
 }
 for(const [col,row,name] of [[20,5,'北方隘口'],[20,17,'中央枢纽'],[20,29,'南方桥头']]){raw.terrain[`${col},${row}`]='city';nodes.push({id:`OBJECTIVE-${row}`,side:null,initialOwner:null,hex:key(col,row),label:name,role:'junction',incomeI:2,sourceQ:0,vp:config.victory.corridorObjectiveVP});}
 nodes.push({id:'WEST-CAPITAL',hex:key(5,17),label:'西方战区总部',role:'capital',initialOwner:'GERMAN',side:'GERMAN',incomeI:0,sourceQ:0,vp:config.victory.capitalVP},{id:'EAST-CAPITAL',hex:key(36,17),label:'东方战区总部',role:'capital',initialOwner:'SOVIET',side:'SOVIET',incomeI:0,sourceQ:0,vp:config.victory.capitalVP});
 raw.terrain['5,17']='maincity';raw.terrain['36,17']='maincity';
 const map=core.importLegacyMap(raw);
 for(const h of map.hexes)h.control=h.coord.q<19?'GERMAN':h.coord.q>19?'SOVIET':null;
 for(const e of map.edges)if(e.railway)e.railway.repairedBy=e.a.q<19&&e.b.q<19?'GERMAN':'SOVIET';
 scenario.deployment={sequence:['SOVIET','GERMAN'],hiddenUntilBothComplete:true,zones:Object.fromEntries(sides.map(side=>[side,{kind:'EXPLICIT_HEXES',hexes:map.hexes.filter(h=>h.control===side).map(h=>h.coord)}])),units:roster};
 let state=core.createDeploymentGameState({scenario,rules,...map,seed:config.seed});const engine=new core.RulesEngine(rules,scenario);
 for(const side of ['SOVIET','GERMAN']){for(const u of placements.filter(u=>u.side===side)){const result=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:side,deploymentUnitId:u.id,hex:u.hex});if(!result.accepted)throw Error(JSON.stringify(result.issues));state=result.state;}
  const result=engine.apply(state,{type:'READY_FOR_PHASE_END',controllerId:side});if(!result.accepted)throw Error(JSON.stringify(result.issues));state=result.state;}
 for(const p of placements)state.units[p.id].step=p.step;
 const issues=core.validateGameStateIntegrity(state,rules,scenario);if(issues.length)throw Error(JSON.stringify(issues));
 return {rules,scenario,state,engine,nodes,placements,raw};
}

