import {writeFileSync} from 'node:fs';
const labels={open:'入口条件允许',entry_block:'仅入口T13—T17受阻',arrears:'入口受阻及E14—E15停源',uncommitted:'同窗口但T13起不承诺新单'};
export function makeTables(results){
 const header='|T/E|行动单位|下单/完成/入场|后方实付/期末欠付 SP|前线源余/实收 SP|前线维护实付/应付|E末SP|最大D|发装备E|攻击满/减|恢复阶|\n|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
 const line=x=>`|${x.turn}|${x.unitsAtAction}|${x.newOrder??'—'}/${x.completed??0}/${x.entered??0}|${x.rearPaidSP??0}/${x.rearArrearsSP??0}|${x.frontSourceAvailableSP??22}/${x.frontIssuedSP??x.spReceived}|${x.maintenancePaid}/${x.maintenanceDemand}|${x.spStock}|${x.debtMax}|${x.shippedE}|${x.fullAttack}/${x.degradedAttack}|${x.recovered}|\n`;
 let main='# INDUSTRY-CONTRACT-004 主路线逐回合账本\n\n全部为条件账本。A从003的E1快照续算T2，B/C/D从E3快照续算T4；更早行原样引用003。前线源余是扣后方后的本E额度，不是库存。攻击列是条件单位参与机会；D为前线债务，后方欠付另列。四路均到唯一E24，不存在E25。\n\n';
 for(const r of results.filter(r=>r.summary.scenario==='open')){main+=`## ${r.summary.route}\n\n`+header+[...r.prefixRows,...r.rows].map(line).join('')+'\n';}
 let window='# INDUSTRY-CONTRACT-004 入口与清欠窗口\n\n每路线/分支列T13—T19；完整E1—E24流水保存在RESULTS.json。清欠与未承诺两分支从同一T13下单前状态分叉；既有订单未取消。停源是共同外部输入，不能把窗口内全部前线缺口归因于后方清欠。\n\n';
 for(const r of results.filter(r=>r.summary.scenario!=='open'))window+=`## ${r.summary.route} ${labels[r.summary.scenario]}\n\n`+header+r.rows.filter(x=>x.turn>=13&&x.turn<=19).map(line).join('')+'\n';
 let orders='# INDUSTRY-CONTRACT-004 订单时间线\n\n下单承诺3P/3E一次。完整付款的整编边界数为1；完成后最早下一T请求入场。本表“入场”全部来自显式条件回执，不是Core事件。“完成延迟”相对接受当E完成；“等待窗口”是实际假想入场T减最早允许T。主分支列所有订单，窗口分支只列T11—T19接受的订单。未承诺分支不生成被拒绝的订单，也不退款旧订单。\n\n';
 for(const r of results){orders+=`## ${r.summary.route} ${labels[r.summary.scenario]}\n\n|订单|下单T|完成E|最早入场T|条件入场T|完成延迟|等待窗口|末状态|\n|---|---:|---:|---:|---:|---:|---:|---|\n`;for(const o of r.finalOrders.filter(o=>r.summary.scenario==='open'||o.acceptedTurn>=11&&o.acceptedTurn<=19))orders+=`|${o.id}|${o.acceptedTurn}|${o.completedEpoch??'未完成'}|${o.entryEligibleFromTurn??'—'}|${o.enteredTurn??'未入场'}|${o.completedEpoch===null?'—':o.completedEpoch-o.acceptedTurn}|${o.enteredTurn===null?'—':o.enteredTurn-o.entryEligibleFromTurn}|${o.status}|\n`;orders+='\n';}
 for(const [n,s] of Object.entries({'LEDGERS.md':main,'WINDOWS.md':window,'ORDERS.md':orders}))writeFileSync(new URL(n,import.meta.url),s.trimEnd()+'\n');
}
