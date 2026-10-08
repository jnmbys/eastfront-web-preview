import {rules} from '../grand-play-001/rules.mjs';
// Display-only trend estimator. Input consists solely of contact-report bands.
export const band=(value,step)=>[Math.floor(Math.max(0,value)/step)*step,Math.min(100,Math.floor(Math.max(0,value)/step)*step+step)];
const mid=b=>(b[0]+b[1])/2;
export function estimate(samples,viewer){
 const base={status:'ASSESSING',label:'评估中',scope:'本次接触',reason:'需要至少三个连续模拟步的接触报告；不预测未来骰点',minutes:null};
 if(samples.length<3)return base;
 const first=samples[0],last=samples.at(-1),span=last.tick-first.tick;
 if(span<2)return base;
 const sides=['GERMAN','SOVIET'],times={};
 for(const side of sides){
  const units=last.units.filter(u=>u.side===side);if(!units.length)return base;
  times[side]=units.map(u=>{
   const start=first.units.find(x=>x.id===u.id);if(!start)return Infinity;
   const orgRate=(mid(start.org)-mid(u.org))/span,lossRate=(mid(start.strength)-mid(u.strength))/span;
   // All participating formations, including support, must reach a stopping condition.
   // Blocked withdrawal reports disable the organization endpoint.
   const org=!u.blocked&&orgRate>.25?Math.max(1,(mid(u.org)-rules.orgRetreat)/orgRate):Infinity;
   const strength=lossRate>.1?Math.max(1,mid(u.strength)/lossRate):Infinity;
   return Math.min(org,strength);
  });
 }
 const totals=Object.fromEntries(sides.map(s=>[s,Math.max(...times[s])])),side=totals.GERMAN<=totals.SOVIET?'GERMAN':'SOVIET',ticks=totals[side];
 if(!Number.isFinite(ticks)||ticks>72)return {...base,status:'STALLED',label:'僵持／暂难估计',reason:'近期趋势不足以推得有限的整组脱离时间；没有0分钟倒计时'};
 const low=Math.max(5,Math.floor(ticks*.65)*5),high=Math.max(low+5,Math.ceil(ticks*1.5)*5);
 const range=high>=120?`约${Math.max(1,Math.floor(low/60))}–${Math.ceil(high/60)}小时`:`约${low}–${high}分钟`;
 return {status:'ESTIMATED',label:range,scope:side===viewer?'预计我方整组撤出或失去战力':'预计对方整组撤出或失去战力',side,minutes:[low,high],asOf:last.tick*5,samples:samples.length,reason:'按近期组织与实力区间趋势，逐队估计、取整组最慢者，再比较双方；包含支援且不重复计数。撤路受阻、增援、换位或补给变化可能延长接触；不是胜率，也不保证此时结束。'};
}
