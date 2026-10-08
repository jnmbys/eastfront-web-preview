import {route,travel} from '../grand-play-001/planner.mjs';
import {eligible} from '../grand-map-r1/policy.mjs';
export function directPreview(c,draft){
 const view=c.fair(c.viewer).view,u=view.units.find(u=>u.id===draft.unit&&u.side===view.viewer);
 const target=draft.target,base={unit:draft.unit,target,version:c.version,path:[],reason:'',kind:draft.kind};
 if(!u||!target||!Number.isSafeInteger(target.q)||!Number.isSafeInteger(target.r))return {...base,reason:'请选择己方部队和地图内目标'};
 const cap=c.capability(u.id);
 if(['ATTACK','SUPPORT'].includes(draft.kind))return {...base,path:[u.hex,target],reason:eligible(view,u,cap,target)??'',label:draft.kind==='SUPPORT'?'相邻支援预览，不自动跟进':'相邻攻击预览'};
 const r=route(view,u.hex,target,cap);
 let total=0,from=u.hex;for(const to of r.path){total+=travel(view,from,to,cap);from=to;}
 return {...base,path:[u.hex,...r.path],expanded:r.expanded,minutes:total*5,reason:r.reason??'',label:'已知通路预览；逐格重评，遭遇和占位变化可能改道或中断'};
}
