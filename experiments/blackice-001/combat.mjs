import {combat,terrain} from './config.mjs';
export function armorFactor(piercing,armor){if(!armor)return 1;const r=piercing/armor;return r>=1?1:r>=.9?.94:r>=.8?.88:r>=.7?.82:r>=.6?.76:r>=.5?.70:.40;}
// Original continuous-time adapter. Only accepted contacts; no future simulation.
export function resolve({contacts,units,stats,random,tick=0,ground=()=>({terrain:'PLAIN'}),fortification=()=>0,fixedFortification=()=>({level:0,factor:1})}){
 const groups=new Map(),participating=new Set(),waiting=new Set(),pairs=[];
 for(const b of contacts){const k=typeof b.hex==='string'?b.hex:JSON.stringify(b.hex);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(b);}
 for(const list of groups.values()){
  const ids=[...new Set(list.flatMap(b=>b.units))].sort(),chosen=new Set(),fronts=new Set(list.flatMap(b=>(b.initiators??[]).map(id=>JSON.stringify(units[id].hex))));
  const t=terrain[ground(list[0].units[1],list[0].units[0]).terrain]??terrain.PLAIN,width=Math.min(combat.maxWidth,t.width+Math.max(0,fronts.size-1)*combat.extraDirection);
  for(const side of ['GERMAN','SOVIET']){const own=ids.filter(id=>units[id].side===side&&!participating.has(id)),offset=own.length?tick%own.length:0;let used=0;
   for(const id of [...own.slice(offset),...own.slice(0,offset)]){if(used+stats[id].paper.width<=width){used+=stats[id].paper.width;chosen.add(id);}else waiting.add(id);}}
  for(const b of list)if(b.units.every(id=>chosen.has(id))){pairs.push(b);b.units.forEach(id=>participating.add(id));}
 }
 const opponents=new Map(),attackers=new Set();for(const b of pairs){(b.initiators??[]).forEach(id=>attackers.add(id));const[a,z]=b.units;for(const[id,to]of[[a,z],[z,a]]){if(!opponents.has(id))opponents.set(id,new Set());opponents.get(id).add(to);}}
 const damage={},orgDamage={},traces=[];
 for(const id of [...opponents.keys()].sort())for(const target of [...opponents.get(id)].sort()){
  const a=stats[id].effective,d=stats[target].effective,g=ground(target,id),t=terrain[g.terrain]??terrain.PLAIN,attacking=attackers.has(id);
  const engineer=stats[id].components.find(c=>c.id==='ENGINEER')?.satisfaction??0;
  const attackTerrain=attacking?t.attack*(g.river?(.65+.15*engineer):1):1;
  const fixed=fixedFortification(target,id,pairs),reverse=fixedFortification(id,target,pairs);
  const defendFort=attackers.has(target)?1:1+(Math.min(.15,fortification(target))+(fixed.level ? .07*(stats[target].components.find(c=>c.id==='ENGINEER')?.satisfaction??0):0));
  const attack=Math.max(0,(a.softAttack*(1-d.hardness)+a.hardAttack*d.hardness)/opponents.get(id).size*attackTerrain*fixed.factor);
  const defense=Math.max(0,(attackers.has(target)?d.breakthrough:d.defense)/opponents.get(target).size*defendFort*(attackers.has(target)?reverse.factor:1));
  const hit=(Math.min(attack,defense)*combat.coveredHit+Math.max(0,attack-defense)*combat.openHit)*combat.cyclesHour/12*armorFactor(a.piercing,d.armor);
  const hp=hit*combat.hpLoss*(1+Math.floor(random()*2)),org=hit*combat.orgLoss*(1+Math.floor(random()*4));
  damage[target]=(damage[target]??0)+hp;orgDamage[target]=(orgDamage[target]??0)+org;traces.push({source:id,target,hp,org,attack,defense,terrain:g.terrain,crossing:!!g.river,...(fixed.level?{fixedFort:fixed}:{}),armorFactor:armorFactor(a.piercing,d.armor)});
 }
 return {damage,orgDamage,traces,participating:[...participating],waiting:[...waiting]};
}
