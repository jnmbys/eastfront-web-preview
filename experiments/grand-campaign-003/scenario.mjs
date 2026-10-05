import fs from 'node:fs';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import {buildGeography as baseGeometry,createScenarioFromGeography,layout as baseLayout} from '../grand-campaign-002/scenario.mjs';
export {config,sides,hex,key} from '../grand-campaign-001/scenario.mjs';
export const terrainConfig=JSON.parse(fs.readFileSync(new URL('./terrain.json',import.meta.url),'utf8'));
export const layout={...baseLayout,id:terrainConfig.id,label:terrainConfig.label};
// Connected axes with interpolated width: regional landforms, never independent cell noise.
export function inBand(c,r,axis){
 for(let i=1;i<axis.length;i++) {const [x,y,w]=axis[i-1],[u,v,z]=axis[i],dx=u-x,dy=v-y,t=Math.max(0,Math.min(1,((c-x)*dx+(r-y)*dy)/(dx*dx+dy*dy)));if(Math.hypot(c-x-t*dx,r-y-t*dy)<=w+(z-w)*t)return true;}
 return false;
}
export function buildGeography(){
 // Generate the baseline once as transient input; keep no second map/cache in this variant.
 const g=baseGeometry({cache:false}),cfg=terrainConfig,riverCells=new Set(g.raw.rivers.flatMap(e=>[e.a.join(','),e.b.join(',')]));
 const riverNear=(c,r,d)=>{if(riverCells.has(`${c},${r}`))return true;if(d===0)return false;const h=core.paperToAxial(core.columnToLetters(c),r);return core.getNeighbors(h).some(n=>{const p=core.axialToPaper(n);return riverCells.has(`${core.lettersToColumn(p.column)},${p.row}`);});};
 const hit=(list,c,r)=>list.some(f=>inBand(c,r,f.axis));
 const types={plain:'PLAIN',forest:'FOREST',hill:'HILL',marsh:'MARSH'};
 for(const h of g.map.hexes){const p=core.axialToPaper(h.coord),c=core.lettersToColumn(p.column),r=p.row,k=`${c},${r}`;
  if(cfg.protectedTerrains.includes(g.raw.terrain[k]))continue;
  let t='plain';if(hit(cfg.forestMassifs,c,r))t='forest';if(hit(cfg.clearings,c,r))t='plain';if(hit(cfg.ridges,c,r))t='hill';if(hit(cfg.valleys,c,r))t='plain';
  if(cfg.wetlandBasins.some(f=>inBand(c,r,f.axis)&&riverNear(c,r,f.riverDistance)))t='marsh';if(hit(cfg.dryBanks,c,r))t='plain';
  g.raw.terrain[k]=t;h.terrain=types[t];
 }
 g.geography.terrainRevision=cfg.id;return g;
}
export function createScenario(){return createScenarioFromGeography(buildGeography(),layout);}
