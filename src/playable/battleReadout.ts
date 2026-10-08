/** A disclosed own-side condition index, never a win probability or enemy estimate. */
export function battleReadout(b:any,viewer:string){
 const own=[...new Map((b.participants??[]).filter((u:any)=>u.side===viewer).map((u:any)=>[u.id,u])).values()] as any[];
 const complete=own.length>0&&own.every(u=>Number.isFinite(u.org));
 const value=complete?Math.round(own.reduce((n,u)=>n+Math.max(0,Math.min(100,u.org)),0)/own.length):null;
 return {value,label:'我方平均组织',text:value===null?'?':String(value),
  symbol:b.status==='WITHDRAWING'?'↶':b.role==='双方投入'?'↔':b.role?.includes('防守')?'◀':'➤',
  meaning:'数字为本方已知参战部队的平均组织度（0–100），每队只计一次；不含敌军状态，不是胜率、损伤比例或完成进度。颜色沿用本方接触报告：绿为暂能维持，赭为承压，灰为依据不足。箭头朝右为本方进攻，朝左为本方防守，双向箭为双方投入，弯箭为发生撤退；不是地理方向。'};
}
