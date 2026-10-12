import {groundFactor} from './weather.mjs';
// Paid tonnage stays in existing escrow. Only the physical last-mile clock changes.
export function makeWork(tick,route,hub,destination,lastCost,infrastructure){
 const paths=hub?.deliveryPaths?.[destination];
 return {lastTick:tick,phase:0,segments:[{remaining:3+route.path.length*4,kind:'RAIL'},...(paths??[{hex:destination,road:false,cost:lastCost}]).map(x=>({...x,kind:'GROUND',...(infrastructure?{infrastructureLevel:infrastructure.levels[infrastructure.index[x.hex]]??0}:{}),remaining:x.cost*(hub?.trucks>0?12:24)/(1+.1*(infrastructure?.levels[infrastructure.index[x.hex]]??0))}))]};
}
export function progressWork(batch,tick,weather){const w=batch.weatherWork;if(!w||tick<w.lastTick)return;
 // Campaign advances one tick at a time; restoring never charges offline wall time.
 let time=tick-w.lastTick;w.lastTick=tick;
 while(time>1e-9&&w.phase<w.segments.length){const s=w.segments[w.phase],factor=s.kind==='RAIL'?1:groundFactor(weather,s.hex,s.road),used=Math.min(time,s.remaining*factor);s.remaining=Math.max(0,s.remaining-used/factor);time-=used;if(s.remaining<1e-9)w.phase++;else break;}
 const estimate=w.segments.slice(w.phase).reduce((n,s)=>n+s.remaining*(s.kind==='RAIL'?1:groundFactor(weather,s.hex,s.road)),0);
 batch.arrival=tick+Math.ceil(Math.max(0,estimate-1e-9));batch.conditionalArrival=true;
}
