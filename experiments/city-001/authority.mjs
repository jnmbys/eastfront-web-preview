import {Campaign as Grand} from '../grand-ux-001/authority.mjs';
import {layout,policy} from './config.mjs';import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
const copy=structuredClone,kh=core.hexKey,fail=x=>{throw Error(x);};
export class Campaign extends Grand{
 constructor(){super();const cities=layout(this.nodes),membership={};
  for(const city of cities){if(city.districts.filter(d=>d.type==='MAIN').length!==1)fail('MAIN_DISTRICT_NOT_UNIQUE');city.main=city.districts.find(d=>d.type==='MAIN').hex;city.owner=this.state.hexes[city.main].control;city.contested=city.districts.some(d=>this.state.hexes[d.hex].control&&city.owner&&this.state.hexes[d.hex].control!==city.owner);
   for(const d of city.districts){if(membership[d.hex]||!this.state.hexes[d.hex])fail('DISTRICT_OVERLAP_OR_MISSING');membership[d.hex]=d.id;d.control=this.state.hexes[d.hex].control;}
   const original=this.nodes.filter(n=>city.districts.some(d=>d.hex===n.hex)),vp=original.reduce((n,x)=>n+x.vp,0);city.vp=vp;city.migrated=original.map(n=>({node:n.id,vp:n.vp,incomeI:n.incomeI,sourceQ:n.sourceQ}));
   for(const n of original)n.vp=0;const mainNode=original.find(n=>n.hex===city.main);if(mainNode)mainNode.vp=vp;else this.nodes.push({id:`VP:${city.id}`,hex:city.main,label:city.label,role:'city',vp,incomeI:0,sourceQ:0});
  }
  this.econ.cities={policy,items:cities,membership,events:[],constructionSpentI:{GERMAN:0,SOVIET:0}};
  for(const f of Object.values(this.econ.ux.facilities)){const w=this.econ.warehouses[f.warehouse];f.district=membership[w.node];f.hex=w.node;f.slot=0;}
 }
 district(hex){return this.econ.cities?.items.flatMap(c=>c.districts).find(d=>d.hex===hex);}
 cityFor(hex){return this.econ.cities?.items.find(c=>c.districts.some(d=>d.hex===hex));}
 canControl(hex,side){if(this.state.pendingDecision)return false;const h=this.state.hexes[hex];if(!h)return false;
  const own=Object.values(this.state.units).some(u=>u.alive&&u.side===side&&kh(u.hex)===hex);
  return !Object.values(this.state.units).some(u=>u.alive&&u.side!==side&&(kh(u.hex)===hex||!own&&this.rules.unitTemplates[u.templateId].exertsZoc&&core.hexDistance(h.coord,u.hex)===1));
 }
 serviceAllowed(w,side){const city=this.cityFor(w.node);if(!city)return true;const stations=city.districts.filter(d=>d.type==='STATION');if(!stations.length)return true;
  const net=this.network(side);return stations.some(d=>this.state.hexes[d.hex].control===side&&this.canControl(d.hex,side)&&this.nodes.some(n=>n.sourceQ&&this.state.hexes[n.hex].control===side&&net.path(n.hex,d.hex)!==null));
 }
 transferDistrict(d,side){const old=d.control;d.control=side;if(old===side)return;
  const w=Object.values(this.econ.warehouses).find(w=>w.node===d.hex);
  if(w){for(const l of w.lots)if(l.qty){l.seizedFrom=l.seizedFrom??old;l.availableTurn=Number.MAX_SAFE_INTEGER;}w.owner=side;
   const line=this.econ.ux.lines[w.id];if(line){line.seizedWork??=[];line.seizedWork.push({side:line.side,progress:copy(line.progress),turn:this.state.turn});for(const k in line.progress)line.progress[k]=0;line.side=side;line.product='IDLE';line.factories=[];}
  }
  for(const f of Object.values(this.econ.ux.facilities).filter(f=>f.district===d.id)){if(f.status==='BUILDING'){f.status='SEIZED_CONSTRUCTION';f.seizedFrom=f.side;}f.side=side;}
  this.econ.cities.events.push({kind:'CONTROL',district:d.id,from:old,to:side,turn:this.state.turn});
 }
 capture(action){super.capture(action);if(!this.econ.cities)return;
  for(const city of this.econ.cities.items){const side=this.state.hexes[city.main].control;if(side!==city.owner){city.owner=side;if(side)for(const d of city.districts)if(d.hex!==city.main&&this.canControl(d.hex,side))this.state.hexes[d.hex].control=side;}
   for(const d of city.districts)this.transferDistrict(d,this.state.hexes[d.hex].control);city.contested=city.districts.some(d=>d.control&&city.owner&&d.control!==city.owner);
  }
 }
 transaction(req,delegated=false){if(req.operation?.type!=='BUILD_FACTORY')return super.transaction(req,delegated);
  if(typeof req.id!=='string'||req.id.length<8)fail('REQUEST_ID_REQUIRED');const signature=JSON.stringify({version:req.version,action:req.action,operation:req.operation});if(this.receipts.has(req.id)){const r=this.receipts.get(req.id);if(r.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(r.result);}
  if(req.version!==this.version)fail('STALE_VERSION');if(this.match.status!=='ACTIVE'||this.state.pendingDecision||this.viewer!==this.state.activeSide)fail('NOT_ACTIVE_SERVICE_WINDOW');
  const d=this.econ.cities.items.flatMap(c=>c.districts).find(d=>d.id===req.operation.district);if(!d||this.state.hexes[d.hex].control!==this.viewer||!this.canControl(d.hex,this.viewer))fail('DISTRICT_UNAVAILABLE');
  const used=Object.values(this.econ.ux.facilities).filter(f=>f.district===d.id);if(used.length>=d.slots)fail('FACTORY_SLOTS_FULL');if(this.econ.accounts[this.viewer].I<policy.constructionI)fail('INSUFFICIENT_I');
  const before=copy(this.econ),beforeNodes=copy(this.nodes);try{
   let w=Object.values(this.econ.warehouses).find(w=>w.node===d.hex);if(!w){const id=`DISTRICT:${d.id}`;w=this.econ.warehouses[id]={id,node:d.hex,owner:this.viewer,capacity:96,lots:[]};this.nodes.push({id,hex:d.hex,label:d.paper,role:'industry',vp:0,incomeI:0,sourceQ:0});}
   if(!this.econ.ux.lines[w.id])this.econ.ux.lines[w.id]={id:w.id,side:this.viewer,product:'IDLE',priority:3,factories:[],progress:Object.fromEntries(Object.keys(this.econ.ux.lines[Object.keys(this.econ.ux.lines)[0]].progress).map(k=>[k,0])),completed:Object.fromEntries(Object.keys(this.econ.ux.lines[Object.keys(this.econ.ux.lines)[0]].completed).map(k=>[k,0])),workAssigned:0};
   const id=`FACTORY:${d.id}:${used.length}`,f={id,district:d.id,hex:d.hex,warehouse:w.id,slot:used.length,side:this.viewer,status:'BUILDING',progress:0,orderedEpoch:this.econ.epoch,paidI:policy.constructionI};this.econ.ux.facilities[id]=f;
   const a=this.econ.accounts[this.viewer];a.I-=policy.constructionI;a.spentI+=policy.constructionI;this.econ.cities.constructionSpentI[this.viewer]+=policy.constructionI;
   if(this.beforePublish)this.beforePublish('BUILD_FACTORY');this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version,facility:id};this.receipts.set(req.id,{signature,result});return result;
  }catch(e){this.econ=before;this.nodes=beforeNodes;throw e;}
 }
 finishEpoch(epoch){if(this.econ.epoch>=epoch)fail('EPOCH_ALREADY_SETTLED');
  for(const f of Object.values(this.econ.ux.facilities))if(f.status==='BUILDING'&&this.state.hexes[f.hex].control===f.side&&this.canControl(f.hex,f.side)){f.progress++;if(f.progress>=policy.constructionEpochs){f.status='BUILT';this.econ.ux.lines[f.warehouse].factories.push(f.id);this.econ.cities.events.push({kind:'BUILT',facility:f.id,epoch});}}
  return super.finishEpoch(epoch);
 }
 snapshot(draft){const d=super.snapshot(draft),view=d.game.message.payload.view,known=this.econ.ux.known[this.viewer],control=hex=>view.hexes.find(h=>kh(h.coord)===hex)?.control??known[hex]??null;
  d.cities={policy,constructionSpentI:this.econ.cities.constructionSpentI[this.viewer],items:this.econ.cities.items.map(city=>({id:city.id,label:city.label,main:city.main,owner:control(city.main),vp:city.vp,
   districts:city.districts.map(d=>{const owner=control(d.hex),own=owner===this.viewer,w=Object.values(this.econ.warehouses).find(w=>w.node===d.hex);return {...d,control:owner,slots:d.slots,facilities:own?Object.values(this.econ.ux.facilities).filter(f=>f.district===d.id).map(f=>({...copy(f),line:this.econ.ux.lines[f.warehouse]?.product})):[],service:own&&w?this.serviceAllowed(w,this.viewer):own&&d.type==='STATION'?this.serviceAllowed({node:d.hex},this.viewer):false,canBuild:own&&d.slots>Object.values(this.econ.ux.facilities).filter(f=>f.district===d.id).length&&this.canControl(d.hex,this.viewer),warehouse:own?w?.id:null,unconfirmed:owner===null};})})).map(c=>({...c,contested:c.districts.some(d=>d.control&&c.owner&&d.control!==c.owner),unconfirmed:c.districts.some(d=>d.unconfirmed)}))};
  return d;
 }
}
