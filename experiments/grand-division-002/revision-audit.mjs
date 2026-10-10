// Directed analysis, NOT a natural campaign or an injection-enabled game entry.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {cfg} from '../grand-economy-002/config.mjs';
import {production} from '../grand-economy-002/economy.mjs';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {modelDemand,modelIds,reference} from './model-demand.mjs';
import {createInventory,validate} from './inventory.mjs';
import {transport} from './freight.mjs';
import {attributes} from './combat.mjs';
import {accrueReception,debitReception,freightPolicy,receptionRates,CURRENT_RECEPTION} from './reception.mjs';
const R='infantry_equipment_1',S='support_equipment_1',zero=()=>({[R]:0,[S]:0});
export function design(engineer=false){const t=emptyDraft();t.regiments[0][0]='INFANTRY';if(engineer)t.support[0]='ENGINEER';return t;}
export function duration(engineer,mode,policy){
 const t=design(engineer),target=modelDemand(t),held=engineer?{[R]:100,[S]:0}:zero(),personnel=engineer?1000:0;
 const deficit={personnel:target.manpower-personnel,...Object.fromEntries(modelIds.map(k=>[k,target.equipment[k]-held[k]]))};
 const pool=mode==='production'?zero():Object.fromEntries(modelIds.map(k=>[k,deficit[k]]));
 const s=createInventory({nations:{GERMAN:{manpower:deficit.personnel,stock:pool},SOVIET:{manpower:0,stock:zero()}},units:{u:{id:'u',side:'GERMAN',personnel,held,target,revision:0,org:0,trainingExperience:0}}});
 const products=Object.fromEntries(modelIds.map(k=>[k,{cost:reference.models[k].cost,resources:k===R?{steel:2}:{steel:2,aluminium:1}}]));
 const e={modelProducts:products,nations:s.nations,lines:{},facilities:{},ledger:[],resourceSites:[{hex:'source',capacity:{steel:100,aluminium:100}}]};
 for(const k of modelIds.filter(k=>deficit[k]>0)){e.facilities[k]={id:k,kind:'MIL',hex:'source',damage:0};e.lines[k]={id:k,side:'GERMAN',product:k,factories:[k],priority:1,efficiency:cfg.efficiencyStart,progress:0,completed:0};}
 const c={econ:{modern:e},state:{hexes:{source:{control:'GERMAN'}}},clock:{tick:0}};
 const room=mode==='transport'?.04:mode==='no-whole-support'?.03:100;
 const network={rows:{u:{routes:[{hub:'h',source:'s',path:['rail']}]}},hubs:[{id:'h',capacity:room,used:0}],trainUsed:0,sources:{},edges:{}};
 const credits={personnel:0,...zero()},completed={},made={},emptyCargo=()=>({train:0,edges:{},hubs:{},sources:{}});let cargo=emptyCargo(),hour=-1;
 for(let tick=1;tick<=cfg.ticksPerDay*120;tick++){
  c.clock.tick=tick;if(mode==='production')production(c);
  for(const k of modelIds)if(deficit[k]&&s.nations.GERMAN.produced[k]>=deficit[k]&&!made[k])made[k]=tick/288;
  const h=Math.floor(tick/cfg.networkTicks);if(h!==hour){cargo=emptyCargo();hour=h;}
  const sent=transport(s,'u',{network,rails:{rail:{level:1,damage:0}},cargo,trainCapacity:100,sourceCapacity:100,railCapacity:100,policy:freightPolicy,rates:accrueReception(credits,1,receptionRates(policy))});
  cargo=sent.cargo;debitReception(credits,sent);const u=s.units.u;
  if(u.personnel===target.manpower&&!completed.personnel)completed.personnel=tick/288;
  for(const k of modelIds)if(u.held[k]===target.equipment[k]&&!completed[k])completed[k]=deficit[k]?tick/288:0;
  if(Object.keys(completed).length===3){validate(s);return {engineer,mode,deficit,completedDays:completed,allDays:tick/288,producedEnoughDays:made,remaining:zero(),residualWorkPerHour:room};}
 }
 validate(s);return {engineer,mode,deficit,completedDays:completed,allDays:null,observedDays:120,producedEnoughDays:made,remaining:Object.fromEntries(modelIds.map(k=>[k,target.equipment[k]-s.units.u.held[k]])),residualWorkPerHour:room,reason:room<freightPolicy[S]?'单次周期余量不足一件支援装备，容量不跨周期累积；有限观察未补齐':'120日观察预算耗尽，非战役终局'};
}
export function attributeCases(){return [
 ['original',design(),1000,100,0],['expanded-no-delivery',design(true),1000,100,0],
 ['support-only-missing',design(true),1300,110,0],['half-support',design(true),1300,110,15],['complete',design(true),1300,110,30]
 ].map(([label,t,personnel,rifles,support])=>({label,personnel,rifles,support,...attributes(t,{personnel,held:{[R]:rifles,[S]:support}})}));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out='evidence/grand-division-002/revision';fs.mkdirSync(out,{recursive:true});
 const result={kind:'directed-real-functions-not-natural-campaign',rates:{personnelDay:cfg.personnelDay,equipmentDay:cfg.equipmentDay,freightPolicy},assumptions:'Resting connected single unit; no losses; each required model has one factory starting .3 efficiency with sufficient resources in production case; hourly capacity resets; same production, reception and freight functions as game. Engineer case adds one company to a fully supplied infantry battalion.',durations:[false,true].flatMap(e=>['stocked','production','transport','no-whole-support'].map(m=>duration(e,m))),approvedDurations:[false,true].flatMap(e=>['stocked','production','transport','no-whole-support'].map(m=>duration(e,m,CURRENT_RECEPTION))),attributes:attributeCases()};
 fs.writeFileSync(out+'/audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result.durations,null,2));
}
