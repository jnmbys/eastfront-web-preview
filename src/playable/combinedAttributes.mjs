// Pure and shared with the editor. All data are supplied by the authorized catalog.
// Explicit approved project aggregation; not a claim to reproduce the original engine.
export function combinedAttributes(template,actual,reference){
 const ids=[...template.regiments.flat(),...template.support].filter(Boolean),line=template.regiments.flat().filter(Boolean),models=reference.models,map=reference.mapping;
 const needs={},needPeople=ids.reduce((n,id)=>n+reference.units[id].manpower,0);
 for(const id of ids)for(const[k,q]of Object.entries(reference.units[id].need))needs[map[k]]=(needs[map[k]]??0)+q;
 const people=Math.max(0,Math.min(1,needPeople?actual.personnel/needPeople:0)),ratio=k=>Math.max(0,Math.min(1,(actual.held[k]??0)/(needs[k]||1)));
 const base=id=>({...models[id]?.archetypeFields,...models[id]?.modelFields}),rifle=base('infantry_equipment_1');
 const paper={orgMax:0,hp:0,width:0,supply:0,softAttack:0,hardAttack:0,defense:0,breakthrough:0,armor:0,piercing:0,hardness:0,speed:Infinity,fuelHour:0},effective={...paper},components=[];
 for(const id of ids){const u=reference.units[id],a=u.scalarDefinitions,support=!reference.families[id],equipment=Object.keys(u.need).map(k=>map[k]),served=Math.min(people,...equipment.map(ratio));
  const combat=id==='ARTILLERY'||id==='SUPPORT_ARTILLERY'?base('artillery_equipment_1'):id==='LIGHT_ARMOR'?base('leichttraktor_lt0'):rifle;
  const truck=id==='MOTORIZED'?base('motorized_equipment_1'):null;
  const p={orgMax:a.max_organisation??0,hp:a.max_strength??0,width:a.combat_width??0,supply:a.supply_consumption??0},e={};
  for(const[k,source]of [['softAttack','soft_attack'],['hardAttack','hard_attack'],['defense','defense'],['breakthrough','breakthrough']]){p[k]=((combat[source]??0)+(truck?.[source]??0))*(1+(a[source]??0));e[k]=p[k]*served;}
  const vehicle=id==='MOTORIZED'?'motorized_equipment_1':id==='LIGHT_ARMOR'?'leichttraktor_lt0':null,vr=vehicle?ratio(vehicle):1;
  p.armor=combat.armor_value??0;p.piercing=combat.ap_attack??0;p.hardness=truck?.hardness??combat.hardness??0;
  e.armor=p.armor*served;e.piercing=p.piercing*served;e.hardness=p.hardness*vr;
  p.speed=(truck?.maximum_speed??combat.maximum_speed??4)*.75;
  e.speed=id==='MOTORIZED'?3+(p.speed-3)*vr:id==='LIGHT_ARMOR'?Math.max(1,p.speed*vr):p.speed;
  p.fuelHour=vehicle?(truck?.fuel_consumption??combat.fuel_consumption??0):0;e.fuelHour=p.fuelHour*vr;
  for(const k of ['orgMax','hp','width','supply','softAttack','hardAttack','defense','breakthrough','fuelHour']){paper[k]+=p[k];effective[k]+=e[k]??p[k];}
  if(!support){paper.speed=Math.min(paper.speed,p.speed);effective.speed=Math.min(effective.speed,e.speed);}
  components.push({id,support,vehicle,personnelRatio:people,equipmentRatios:Object.fromEntries(equipment.map(k=>[k,ratio(k)])),satisfaction:served,orgTerm:p.orgMax,orgWeight:1/ids.length,paper:p,effective:{...p,...e},terrain:u.terrain??{}});
 }
 paper.orgMax/=Math.max(1,ids.length);if(!line.length)paper.speed=effective.speed=0;effective.orgMax=paper.orgMax;
 const mix=(xs,k)=>xs.length?.4*Math.max(...xs.map(x=>x[k]))+.6*xs.reduce((n,x)=>n+x[k],0)/xs.length:0;
 for(const [target,which]of [[paper,'paper'],[effective,'effective']]){const lines=components.filter(x=>!x.support).map(x=>x[which]);target.armor=mix(lines,'armor');target.piercing=mix(components.map(x=>x[which]),'piercing');target.hardness=lines.reduce((n,x)=>n+x.hardness,0)/Math.max(1,line.length);}
 return {policy:'DIVISION-003-COMBAT-ADAPTATION-1',paper,effective,components,personnelRatio:people,equipmentRatios:Object.fromEntries(Object.keys(needs).map(k=>[k,ratio(k)]))};
}
export function terrainModifier(a,terrain,kind){const key={PLAIN:'plains',FOREST:'forest',MOUNTAIN:'mountain',HILL:'hills',MARSH:'marsh',CITY:'urban'}[terrain]??terrain?.toLowerCase(),parts=a.components.filter(x=>!x.support);return parts.length?parts.reduce((n,x)=>n+(x.terrain[key]?.[kind]??0),0)/parts.length:0;}
export function fuelAdjusted(a,fuel){
 const out=structuredClone(a),need=a.effective.fuelHour/12,ratio=need>0?Math.min(1,Math.max(0,fuel??0)/need):a.components.some(c=>c.id==='LIGHT_ARMOR')?0:1;out.fuelRatio=ratio;
 if(ratio>=1)return out;
 for(const c of out.components){if(!c.vehicle)continue;const e=c.effective;
  if(c.id==='LIGHT_ARMOR'){out.effective.softAttack-=e.softAttack*.75*(1-ratio);out.effective.hardAttack-=e.hardAttack*.75*(1-ratio);out.effective.breakthrough-=e.breakthrough*.75*(1-ratio);out.effective.speed=Math.min(out.effective.speed,e.speed*ratio);}
  else {out.effective.speed=Math.min(out.effective.speed,3+(e.speed-3)*ratio);const foot=3*(1+(0))*c.satisfaction;out.effective.breakthrough-=Math.max(0,e.breakthrough-foot)*(1-ratio);}
 }
 return out;
}
