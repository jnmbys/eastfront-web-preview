/** Coarse authorized contact report; no invented score or enemy private data. */
export function battleReadout(b:any,_viewer:string){
 const text=b.status==='WITHDRAWING'?'撤出中':b.outlook==='STRAINED'?'承压':b.outlook==='FAVORABLE'?'可维持':b.ticks<2?'接战评估':'持续交战';
 return {text,meaning:'本次接触报告：承压表示己方平均组织低于自身上限35%或本步平均下降超过12个百分点；可维持表示接战至少两步、己方平均组织至少自身上限60%、本步下降不超过5个百分点且人员损失少于8；其余显示持续交战，刚接触显示评估中。这只是己方当前承受状况，不是胜率或敌我实力比较。撤出中仅表示实际交战记录正在发生撤出。小箭头沿已授权的实际攻击来源指向交战地；多方向分别保留，缺少来源不猜方向。'};
}
