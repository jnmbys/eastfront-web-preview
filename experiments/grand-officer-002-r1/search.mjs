import crypto from 'node:crypto';
import {hexKey as key} from '../../vendor/eastfront-digital-core/dist/index.js';
import {route} from '../grand-play-001/planner.mjs';
export const STEP_BUDGET=400;
const indexes=new WeakMap();
// Only authorized map facts/contacts participate. Own condition enters the route key via mobility.
export function searchContext(view,store,shared,allowedGroup,tacticalOrders){
 const signature=crypto.createHash('sha256').update(JSON.stringify([view.viewer,view.hexes,view.edges,view.identifiedHexKeys,view.units.map(u=>[u.id,u.side,u.hex,u.friendly?.alive])])).digest('hex');
 if(store.signature!==signature){store.signature=signature;store.paths={};store.invalidations=(store.invalidations??0)+1;indexes.delete(store);}
 let index=indexes.get(store);if(!index){index={hexes:new Map(view.hexes.map(h=>[key(h.coord),h])),edges:new Map(view.edges.map(e=>[e.key,e]))};indexes.set(store,index);}
 return {index,allowedGroup,tacticalOrders,get remaining(){return shared.remaining;},route(from,to,cap,budget){
  const k=JSON.stringify([key(from),key(to),cap.mobility]);
  if(store.paths[k]){shared.hits++;return {...structuredClone(store.paths[k]),expanded:0};}
  const r=route(view,from,to,cap,0,Math.min(budget,shared.remaining),index);shared.remaining-=r.expanded;shared.expanded+=r.expanded;
  // Budget-limited failures are not proofs of no route and cannot poison a later, larger search.
  if(r.path.length||key(from)===key(to)||r.reason?.startsWith('已知')){if(Object.keys(store.paths).length>=96)delete store.paths[Object.keys(store.paths)[0]];store.paths[k]=structuredClone(r);}
  return r;
 }};
}
