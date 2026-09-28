from pathlib import Path
r=Path(__file__).parent/'core/src'
changes={'core/types.ts': [('export interface UnitState{','export interface UnitState{expSupply?:{attackFactor:number;movementCap:number|null};'),('export interface GameState{','export interface GameState{expSupplyMode?:boolean;')],
'rules/unit.ts':[('return template.steps[unit.step];','const stats=template.steps[unit.step];\n  if (!unit.expSupply) return stats;\n  return {...stats,attack:Math.ceil(stats.attack*unit.expSupply.attackFactor),movement:unit.expSupply.movementCap===null?stats.movement:Math.min(stats.movement,unit.expSupply.movementCap)};')],
'rules/movement.ts':[("unit.supplyState==='OUT_OF_SUPPLY'?rules.supply.oosMovementPenalty:0","!unit.expSupply&&unit.supplyState==='OUT_OF_SUPPLY'?rules.supply.oosMovementPenalty:0"),("unit.supplyState === 'OUT_OF_SUPPLY' ? rules.supply.oosMovementPenalty : 0","!unit.expSupply && unit.supplyState === 'OUT_OF_SUPPLY' ? rules.supply.oosMovementPenalty : 0"),('const maxMP = Math.max(0,baseMovement - supplyPenalty + roadBonus);','const maxMP = Math.min(unit.expSupply?.movementCap??Infinity,Math.max(0,baseMovement - supplyPenalty + roadBonus));')],
'rules/combat.ts':[("return unit.supplyState==='OUT_OF_SUPPLY'?Math.ceil(a*rules.supply.oosAttackMultiplier):a;","return !unit.expSupply&&unit.supplyState==='OUT_OF_SUPPLY'?Math.ceil(a*rules.supply.oosAttackMultiplier):a;"),("defenders.every(u=>u.supplyState==='OUT_OF_SUPPLY')","defenders.every(u=>!u.expSupply&&u.supplyState==='OUT_OF_SUPPLY')")],
'rules/supply.ts':[('unit.supplyState=supplyState;','if (!state.expSupplyMode) unit.supplyState=supplyState;')],
'engine/RulesEngine.ts':[('if (checkpoint) {','if (checkpoint && !next.expSupplyMode) {')]}
for name,repls in changes.items():
 p=r/name;s=p.read_text()
 for a,b in repls:
  assert a in s,name;s=s.replace(a,b)
 p.write_text(s)
p=Path(__file__).parent/'player-view.mjs';p.write_text(p.read_text().replace('../supply-exp-003-source/vendor/eastfront-digital-core/dist/index.js','./core/dist/index.js'))
