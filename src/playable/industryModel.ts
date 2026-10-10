/** Display-only projection of a complete authorized snapshot. No engine queries. */
export const industryEnabled=(p:any)=>p.selections['industry-art']!=='off' && new URLSearchParams(location.search).get('industryArt')!=='legacy';
export const workLabels:Record<string,string>={ACTIVE:'生产中',MISSING:'缺原料',IDLE:'未分配',DAMAGED:'厂房损坏',BUILDING:'施工中',QUEUED:'排队施工',OCCUPIED:'失守停工'};
/** Original compact silhouettes; decorative, product names remain accessible text. */
export function equipmentIcon(k:string){
 k=({infantry_equipment_1:'RIFLE',support_equipment_1:'KIT',artillery_equipment_1:'GUN',motorized_equipment_1:'TRUCK',leichttraktor_lt0:'TANK'} as Record<string,string>)[k]??k;
 const paths:Record<string,string>={RIFLE:'M3 16l5-5 3 2 10-9M6 13l4 4M11 10l2 2',GUN:'M4 15h12l-3-5H9l12-5M7 15v4m-3 0h6m5-4 5 4',AT:'M3 15h13l-3-4H9l12-4M5 15v4m-3 0h6m7-4 5 4',TANK:'M3 13h16l3 3-2 3H4l-2-3zM7 13V9h8v4m0-3h7',HEAVY:'M2 13h18l2 3-2 4H3l-2-4zM6 13V7h11v6m0-4h6M5 17h13',KIT:'M4 9h16v11H4zM8 9V5h8v4M9 14h6m-3-3v6',SCOUT:'M3 17V9h6v8zm12 0V9h6v8zM9 12h6M4 9V6h4v3m8 0V6h4v3',TRUCK:'M2 8h12v9H2zM14 11h5l3 4v2h-8M5 17v3m13-3v3',FUEL:'M7 4h10v4l3 3v10H4V8h3zM8 13h8m-4-3v7',TRAIN:'M5 3h14v15H5zM8 6h8v5H8zM7 15h2m6 0h2M8 18l-3 4m11-4 3 4M6 21h12'};
 return `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="${paths[k]??paths.KIT}"/></svg>`;
}
export function districtFacilities(data:any,d:any){
 if(!data.modern||d.hidden||d.unconfirmed||d.control!==data.viewer)return d.facilities;
 const m=data.modern;
 const records=m.facilities.filter((f:any)=>f.district===d.id).map((f:any)=>{
  const line=m.lines.find((l:any)=>l.factories.includes(f.id)),working=f.kind==='CIV'?m.queue.some((q:any)=>q.status==='BUILDING'):!!line?.workDay;
  const state=line?.missing?.length?'MISSING':working?'ACTIVE':'IDLE';
  return {id:f.id,slot:d.facilities.find((x:any)=>x.id===f.id)?.slot,status:'BUILT',kind:f.kind,damage:f.damage,workState:state,product:line?m.products[line.product]?.label:undefined};
 });
 for(const q of m.queue.filter((q:any)=>['MIL','CIV'].includes(q.kind)&&q.target===d.id&&q.status!=='DONE'))records.push({id:'FACTORY:'+q.id,status:q.status,kind:q.kind,workState:q.status,progressRatio:Math.max(0,Math.min(1,q.progress/q.cost))});
 return records;
}
export function constructionTiming(m:any,q:any){
 if(q.status==='DONE')return '已完工';
 if(q.status==='OCCUPIED')return '失守停工，完工时间待定';
 const rate=m.facilities.filter((f:any)=>f.kind==='CIV').reduce((n:number,f:any)=>n+(m.config?.civilWorkDay??6)*(1-f.damage),0);
 if(rate<=0)return '无可用民厂，等待恢复';
 const order=m.queue.filter((x:any)=>x.status!=='DONE'&&x.status!=='OCCUPIED').slice().sort((a:any,b:any)=>a.priority-b.priority||a.serial-b.serial),index=order.findIndex((x:any)=>x.id===q.id);
 const work=order.slice(0,index+1).reduce((n:number,x:any)=>n+Math.max(0,x.cost-x.progress),0);
 return `约${Math.max(1,Math.ceil(work/rate*24))}游戏小时（当前队列与民厂不变）`;
}
