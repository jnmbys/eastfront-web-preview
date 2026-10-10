import {rules} from '../grand-play-001/rules.mjs';
// Display-only probability under an explicit, uncalibrated trend model.
// Uses already-authorized 10-point contact bands, never private precise state,
// the battle RNG, predicted orders or a second simulation of combat.
export function winEstimate(samples,viewer){
 const pending={percent:null,status:'ASSESSING',scope:'对方整组先撤出或失去战力',model:'CONTACT-TREND-1',reason:'至少三个连续授权报告，并观察到区间趋势后估计。'};
 if(samples.length<3)return pending;
 const first=samples[0],last=samples.at(-1),span=last.tick-first.tick;
 const sides=['GERMAN','SOVIET'];if(span<2||sides.some(s=>!last.units.some(u=>u.side===s)))return pending;
 const mid=b=>(b[0]+b[1])/2,lerp=(b,q)=>b[0]+(b[1]-b[0])*q;
 if(!last.units.some(u=>{const v=first.units.find(x=>x.id===u.id);return v&&(mid(v.org)>mid(u.org)||mid(v.strength)>mid(u.strength));}))return {...pending,status:'STALLED',reason:'报告区间尚无明确损耗趋势，暂不编造概率。'};
 const times={};
 for(const side of sides){times[side]=[];for(const q0 of [.1,.3,.5,.7,.9])for(const q1 of [.1,.3,.5,.7,.9]){
  const end=last.units.filter(u=>u.side===side).map(u=>{const start=first.units.find(x=>x.id===u.id);if(!start)return Infinity;
   const endpoint=(field,threshold)=>{const now=lerp(u[field],q1),rate=(lerp(start[field],q0)-now)/span;return rate>0?Math.max(0,now-threshold)/rate:Infinity;};
   return Math.min(u.blocked?Infinity:endpoint('org',rules.orgRetreat),endpoint('strength',0));});
  times[side].push(Math.max(...end));
 }}
 const enemy=sides.find(s=>s!==viewer);let wins=0,unknown=0,total=0;
 for(const own of times[viewer])for(const other of times[enemy]){total++;if(!Number.isFinite(own)&&!Number.isFinite(other)){unknown++;wins+=.5;}else wins+=other<own?1:other===own?.5:0;}
 if(unknown/total>.8)return {...pending,status:'STALLED',reason:'整组仍有无有限退出趋势的参战部队，暂难估计。'};
 return {...pending,percent:Math.max(5,Math.min(95,Math.round(wins/total*20)*5)),status:'ESTIMATED',asOf:last.tick*5,samples:samples.length,reason:'预计胜率仅指这次接触中对方整组先撤出或失能。用近期10点区间报告，假设区间内均匀、当前损耗趋势持续，以双方各25种区间取样比较整组最慢退出者；双方含支援，逐队去重。四舍五入至5%，不显示0或100。模型未经实测校准，不是钢四公式；增援、供给、改令与撤路变化会使估计失效，不保证占领。'};
}
