import {Campaign as Base} from '../hoi4-factory-conversion-001/authority.mjs';
import {VERSION,POLICY,add,cities,step} from './model.mjs';
import {validate} from '../grand-division-002/inventory.mjs';
import {sync} from '../grand-ux-001/equipment.mjs';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
export {VERSION};
const copy=structuredClone;
export class Campaign extends Base{
 static newCampaignClass=Campaign;static rulesVersion=VERSION;
 constructor(){super();this.clock.divisionLedger.recruitment={version:VERSION,serial:{GERMAN:0,SOVIET:0},units:{},reservations:{},transit:[],history:[],events:[]};}
 ownOrder(id){return super.ownOrder(id)??{kind:'HOLD',target:copy(this.state.units[id].hex),paused:true,risk:'LOW'};}
 transaction(req){if(!req.operation?.type?.startsWith('RECRUIT_'))return super.transaction(req);const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');if(req.version!==this.version)throw Error('STALE_VERSION');if(this.clock.ended)throw Error('CAMPAIGN_FINISHED');const before=this.checkpoint();try{const r=this.clock.divisionLedger.recruitment,op=req.operation;let ids=[];if(op.type==='RECRUIT_ADD')ids=add(this,this.viewer,op);else{const u=r.units[op.id];if(!u||u.side!==this.viewer)throw Error('RECRUIT_NOT_OWNED');if(op.type==='RECRUIT_CANCEL'){u.status='CANCELLING';u.reason='已停止新调运；在途货物到站后返运，暂停时不推进';}else if(op.type==='RECRUIT_PRIORITY'){if(![-1,1].includes(op.direction))throw Error('INVALID_PRIORITY');const rows=Object.values(r.units).filter(x=>x.side===this.viewer).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id)),i=rows.indexOf(u),other=rows[i+op.direction];if(other)[u.rank,other.rank]=[other.rank,u.rank];}else throw Error('UNKNOWN_RECRUIT_COMMAND');}
 validate(this.clock.divisionLedger);this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version,ids};this.receipts.set(req.id,{signature,result});return copy(result);
 }catch(error){this.restore(before,before.clock.paused);throw error;}}
 economyStep(){super.economyStep();if(this.clock.divisionLedger.recruitment){step(this);validate(this.clock.divisionLedger);}}
 deployRecruit(u){const p=this.clock.divisionLedger,r=p.recruitment,id=u.id;const exemplar=Object.keys(this.state.units).find(id=>this.state.units[id].side===u.side),[q,rr]=u.hex.split(',').map(Number),hex={q,r:rr};
 // New permanent ID; none of the donor's equipment, tasks or progress is copied.
 const current=p.formal.templates[u.templateId],templateId=current?.version===u.templateVersion?u.templateId:id+':formal';if(!p.formal.templates[templateId])p.formal.templates[templateId]={...copy(u.template),id:templateId};
 p.units[id]={id,side:u.side,templateId,templateVersion:u.templateVersion,target:copy(u.target),personnel:u.personnel,held:copy(u.held),revision:0,org:0,trainingExperience:u.trainingExperience};
 this.state.units[id]={id,templateId:'EQUIPPED:'+id,side:u.side,type:'INFANTRY',step:0,alive:true,hex,supplyState:'OUT_OF_SUPPLY',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:u.side,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
 this.clock.units[id]={commandGeneration:0,org:0,personnel:u.personnel,max:u.target.manpower,losses:0,rest:0,march:null,direct:{kind:'HOLD',target:hex,risk:'LOW',paused:true},reason:'新部队已部署，驻守恢复组织',engaged:0,retreat:false,carriedHours:0,trainingExperience:u.trainingExperience};
 this.econ.gear.units[id]={base:copy(this.econ.gear.units[exemplar].base),recipe:{},held:p.units[id].held,staged:[],ratio:1};this.econ.supply[id]={stock:0,debt:0,short:0};this.placements.push({id,side:u.side,hex,army:'直属',step:0});
 this.clock.provinces.origins[id]=this.clock.provinces.index[u.hex];if(p.fuel)p.fuel.units[id]=0;
 r.history.push({id,side:u.side,status:'DEPLOYED',tick:this.clock.tick,city:u.city,personnel:u.personnel,equipment:copy(u.held),training:u.trainingExperience});delete r.units[id];
 this.bindModels(true);sync(this);this.observeVision();refreshNetwork(this);
 }
 snapshot(draft){const d=super.snapshot(draft),r=this.clock?.divisionLedger?.recruitment;if(!r)return d;d.recruitment={version:VERSION,policy:POLICY,units:copy(Object.values(r.units).filter(u=>u.side===this.viewer)),transit:copy(r.transit.filter(b=>b.side===this.viewer)),reservations:copy(Object.values(r.reservations).filter(b=>b.side===this.viewer)),history:copy(r.history.filter(x=>x.side===this.viewer)),cities:cities(this,this.viewer).map(({hubs,...x})=>x)};return d;}
 restore(s,pause=true){if(s.clock?.divisionLedger?.recruitment?.version!==VERSION)throw Error('RECRUITMENT_NEW_CAMPAIGN_REQUIRED');super.restore(s,pause);validate(this.clock.divisionLedger);}
}
