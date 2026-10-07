import {config as originalRules} from '../grand-campaign-001/scenario.mjs';
const copy=structuredClone,NEVER=Number.MAX_SAFE_INTEGER;
export function remember(c){
 for(const w of Object.values(c.econ.warehouses))for(const l of w.lots){
  l.asset??={owner:w.owner,originalQty:l.qty,availableTurn:l.availableTurn,origin:l.origin??l.id,reasons:l.availableTurn===NEVER?['PRIOR_QUARANTINE']:[]};
 }
 for(const f of Object.values(c.econ.ux.facilities))f.asset??={owner:f.side,paidI:f.paidI??0,originalStatus:f.status};
}
function refreshLot(c,l,controller){
 const a=l.asset;if(a.reasons.includes('OCCUPATION')&&a.owner===controller)a.recoveredTurn=c.state.turn;a.reasons=a.reasons.filter(r=>r!=='OCCUPATION');
 if(a.owner!==controller)a.reasons.push('OCCUPATION');
 if(l.type==='P'&&Number.isFinite(l.expiresAfterEpoch)&&c.econ.epoch>=l.expiresAfterEpoch&&!a.reasons.includes('PERSONNEL_EXPIRED'))a.reasons.push('PERSONNEL_EXPIRED');
 l.availableTurn=a.reasons.length?NEVER:a.availableTurn;
}
export function restoreWork(c,line,side){
 const pending=(line.seizedWork??[]).filter(w=>w.side===side&&!w.restored);
 for(const w of pending){
  const occupied=new Set(Object.values(c.econ.ux.lines).filter(l=>l!==line).flatMap(l=>l.factories));
  const ids=w.factories.filter(id=>c.econ.ux.facilities[id]?.side===side&&c.econ.ux.facilities[id].status==='BUILT');
  if(line.side!==side||line.product!=='IDLE'||Object.values(line.progress).some(n=>n>0)||ids.some(id=>occupied.has(id))){w.status='WAITING_ALLOCATION';continue;}
  line.activeWorkId=w.id;line.progress=copy(w.progress);line.product=w.product;line.priority=w.priority;line.factories=ids;w.restored=true;w.status='RESTORED';w.restoredTurn=c.state.turn;
 }
}
export function transfer(c,d,side){
 const old=d.control;if(old===side)return;remember(c);d.control=side;
 const w=Object.values(c.econ.warehouses).find(w=>w.node===d.hex),line=w&&c.econ.ux.lines[w.id];
 if(w){for(const l of w.lots)refreshLot(c,l,side);w.owner=side;}
 if(line){line.seizedWork??=[];
  if(line.factories.length||line.product!=='IDLE'||Object.values(line.progress).some(n=>n>0)){
   let work=line.seizedWork.find(w=>w.id===line.activeWorkId);
   if(!work){work={id:`WIP:${line.id}:${line.seizedWork.length}`,side:line.side,originalProgress:copy(line.progress),history:[]};line.seizedWork.push(work);}
   work.history.push({turn:c.state.turn,progress:copy(line.progress)});
   Object.assign(work,{product:line.product,progress:copy(line.progress),factories:copy(line.factories),priority:line.priority,turn:c.state.turn,status:'OCCUPATION',restored:false});
  }
  line.activeWorkId=null;
  for(const p in line.progress)line.progress[p]=0;line.side=side;line.product='IDLE';line.factories=[];
 }
 for(const f of Object.values(c.econ.ux.facilities).filter(f=>f.district===d.id)){
  f.side=side;
  if(f.status==='BUILDING'||f.status==='SEIZED_CONSTRUCTION')f.status=f.asset.owner===side?'BUILDING':'SEIZED_CONSTRUCTION';
 }
 if(line)restoreWork(c,line,side);
 c.econ.cities.events.push({kind:'CONTROL',district:d.id,from:old,to:side,turn:c.state.turn});
}
// Occupied personnel remain physically in the warehouse. Their original owner pays
// ordinary care; occupation never grants a free holiday or changes an expiry date.
export function beforeEpoch(c,epoch){
 remember(c);
 for(const w of Object.values(c.econ.warehouses)){
  for(const l of w.lots){if(l.type==='P'&&Number.isFinite(l.expiresAfterEpoch)&&epoch>l.expiresAfterEpoch&&!l.asset.reasons.includes('PERSONNEL_EXPIRED'))l.asset.reasons.push('PERSONNEL_EXPIRED');refreshLot(c,l,w.owner);}
 }
 for(const l of Object.values(c.econ.ux.lines))restoreWork(c,l,l.side);
}
export function afterEpoch(c){remember(c);const epoch=c.econ.epoch;for(const w of Object.values(c.econ.warehouses)){
  const held=w.lots.filter(l=>l.type==='P'&&l.qty&&l.asset.reasons.includes('OCCUPATION')&&!l.asset.reasons.some(r=>r!=='OCCUPATION'));
  for(const side of ['GERMAN','SOVIET']){const lots=held.filter(l=>l.asset.owner===side),P=lots.reduce((n,l)=>n+l.qty,0);if(!P)continue;
   const I=Math.ceil(P/4)*originalRules.economy.careIperFourPperEpoch,a=c.econ.accounts[side];if(a.I>=I){a.I-=I;a.spentI+=I;c.econ.cities.events.push({kind:'OCCUPIED_PERSONNEL_CARE',warehouse:w.id,side,P,I,epoch});}
   else for(const l of lots)l.asset.reasons.push('PERSONNEL_CARE_UNPAID');
  }
for(const l of w.lots){if(l.availableTurn===NEVER&&!l.asset.reasons.length)l.asset.reasons.push(l.type==='P'?'PERSONNEL_CARE_UNPAID':'PRIOR_QUARANTINE');refreshLot(c,l,w.owner);}}}
export function assetsView(c,w,side){
 if(!w)return [];return w.lots.filter(l=>l.qty&&l.asset?.owner===side).map(l=>({id:l.id,type:l.type,qty:l.qty,originalQty:l.asset.originalQty,owner:l.asset.owner,recoveredTurn:l.asset.recoveredTurn,availableTurn:l.asset.availableTurn,reasons:[...l.asset.reasons,...(!c.serviceAllowed(w,side)?['ROUTE_OR_STATION_UNAVAILABLE']:[]),...(l.asset.availableTurn>c.state.turn&&l.asset.availableTurn<NEVER?['NOT_YET_AVAILABLE']:[])]}));
}

