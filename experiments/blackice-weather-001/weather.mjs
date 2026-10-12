// Project scale: one tick = five game minutes. No combat RNG or military input.
export const VERSION='BLACKICE-WEATHER-001-1';
export const parameters=Object.freeze({zoneHexes:8,decisionTicks:72,wetPerHour:.06,dryPerHour:.015,mudThreshold:.3,roadRain:.05,roadMud:.30,offroadRain:.15,offroadMud:1.2});
const key=h=>typeof h==='string'?h:`${h.q},${h.r}`;
export function zoneId(h){const[q,r]=key(h).split(',').map(Number);return `${Math.floor(q/8)}:${Math.floor(r/8)}`;}
function random(w){let x=w.rng;x^=x<<13;x^=x>>>17;x^=x<<5;w.rng=x>>>0;return w.rng/4294967296;}
export function createWeather(hexes,seed=219031,tick=0){
 const ids=[...new Set(Object.keys(hexes).map(zoneId))].sort(),zones=Object.fromEntries(ids.map(id=>[id,{id,rain:false,wet:0}]));
 return {version:VERSION,seed:seed>>>0,rng:(seed^0x6d2b79f5)>>>0||1,tick,revision:0,zones};
}
export function advanceWeather(w,tick){
 if(!w||tick<=w.tick)return;
 for(let t=w.tick+1;t<=tick;t++){
  if(t%parameters.decisionTicks===0){const old=structuredClone(w.zones);for(const z of Object.values(w.zones)){const[q,r]=z.id.split(':').map(Number),adj=[[q-1,r],[q+1,r],[q,r-1],[q,r+1]].map(a=>old[a.join(':')]).filter(Boolean),near=adj.filter(a=>a.rain).length/Math.max(1,adj.length);z.rain=random(w)<(old[z.id].rain?.70:.18)+near*.18;}}
  for(const z of Object.values(w.zones))z.wet=Math.max(0,Math.min(1,z.wet+(z.rain?parameters.wetPerHour:-parameters.dryPerHour)/12));
 }
 w.revision+=tick-w.tick;w.tick=tick;
}
export function conditions(w,h){const z=w?.zones[zoneId(h)];return z?{zone:z.id,rain:z.rain,wet:z.wet,mud:Math.max(0,(z.wet-parameters.mudThreshold)/(1-parameters.mudThreshold))}:{zone:null,rain:false,wet:0,mud:0};}
export function groundFactor(w,h,road=false){const c=conditions(w,h);return 1+(c.rain?(road?parameters.roadRain:parameters.offroadRain):0)+c.mud*(road?parameters.roadMud:parameters.offroadMud);}
export function publicWeather(w){return {version:w.version,tick:w.tick,zones:Object.values(w.zones).map(z=>({...conditions(w,z.id.split(':').map(Number).map(x=>x*8).join(',')),roadFactor:groundFactor(w,z.id.split(':').map(Number).map(x=>x*8).join(','),true),offroadFactor:groundFactor(w,z.id.split(':').map(Number).map(x=>x*8).join(','))})),rule:'地区天气为双方公开信息；不包含敌军、控制变化或运输情报。每步5分钟；雨停后继续排水，无预报。'};}
