import {hexKey as key,hexDistance as distance} from '../../vendor/eastfront-digital-core/dist/index.js';
// Bounded, pure authorized-view assignment. No authority, hidden occupancy or RNG.
export function validateFront(front,view,limit=8){
 if(front===undefined)return;
 if(!Array.isArray(front)||!front.length||front.length>limit)throw Error('FRONT_REQUIRES_1_TO_'+limit+'_CONNECTED_HEXES');
 const known=new Map(view.hexes.map(h=>[key(h.coord),h]));const seen=new Set();
 for(const h of front){if(!Number.isSafeInteger(h?.q)||!Number.isSafeInteger(h?.r)||!known.has(key(h))||known.get(key(h)).terrain==='LAKE'||seen.has(key(h)))throw Error('INVALID_PUBLIC_FRONT');seen.add(key(h));}
 const reached=[front[0]];while(true){const next=front.find(h=>!reached.includes(h)&&reached.some(p=>distance(p,h)===1));if(!next)break;reached.push(next);}if(reached.length!==front.length)throw Error('FRONT_MUST_BE_CONNECTED');
}
export function assignFront(view,group,states){
 const front=group.order.front??[], own=view.units.filter(u=>u.side===view.viewer&&group.members.includes(u.id)&&!states[u.id]?.direct).sort((a,b)=>a.id.localeCompare(b.id));
 const load=new Map(front.map(h=>[key(h),0])),assigned={};
 // Balance frontage first, then distance; stable IDs only resolve exact ties.
 for(const u of own){const h=front.slice().sort((a,b)=>load.get(key(a))-load.get(key(b))||distance(u.hex,a)-distance(u.hex,b)||key(a).localeCompare(key(b)))[0];if(h){assigned[u.id]=h;load.set(key(h),load.get(key(h))+1);}}
 return {assigned,unassigned:front.filter(h=>!load.get(key(h))),covered:front.filter(h=>own.some(u=>distance(u.hex,h)<=1)),count:own.length};
}
