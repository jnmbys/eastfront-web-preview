// Authorized DTO only. Does not alter contacts, damage, commands or battle IDs.
export function uniqueActions(actions){
 const map=new Map();
 for(const a of actions){
  const signature=JSON.stringify([a.unit,a.kind,a.status,a.path??[a.from,a.to]]),old=map.get(signature);
  if(old){if(a.battleId&&!old.battleIds.includes(a.battleId))old.battleIds.push(a.battleId);continue;}
  map.set(signature,{...structuredClone(a),id:`unit-action:${signature}`,battleIds:a.battleId?[a.battleId]:[]});
 }
 return [...map.values()];
}
export function explainBattle(b){
 b.factors=['本候选按编制有效攻击与防御／突破、日常供给及同时掷骰结算。','地形与道路影响行军；尚未接入工兵渡河／壕沟、侦察选战术和地形伤害修正。','组织上限为各营／支援连上限的等权平均；不是整场战况或胜率。'];
 for(const u of b.participants??[])delete u.cover;
 return b;
}
