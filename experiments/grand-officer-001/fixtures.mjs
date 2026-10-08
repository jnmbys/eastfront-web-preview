// Explicitly directed fixtures, never presented as normal campaign history.
import {Campaign} from './authority.mjs';
export function rotationFixture(){const c=new Campaign(),g=c.clock.corps[0],ids=g.members.slice(0,4),enemy=c.clock.corps.find(g=>g.side==='SOVIET').members[0],guard=c.clock.corps.filter(g=>g.side==='SOVIET').at(-1).members.at(-1);
 for(const u of Object.values(c.state.units)){if(!ids.includes(u.id)&&u.id!==enemy&&u.id!==guard)u.alive=false;}
 // Keep real terrain/equipment/resources; relocation and fatigue are directed test inputs only.
 const positions=[{q:23,r:4},{q:23,r:4},{q:22,r:4},{q:22,r:5}];
 for(let i=0;i<ids.length;i++){const u=c.state.units[ids[i]],v=c.clock.units[ids[i]];u.hex=positions[i];v.org=i===0?36:92;v.direct=null;c.state.hexes[u.hex.q+','+u.hex.r].control='GERMAN';}
 c.state.units[enemy].hex={q:24,r:4};c.state.hexes['24,4'].control='SOVIET';c.clock.units[enemy].org=65;c.state.units[guard].hex={q:34,r:2};c.clock.units[guard].direct={kind:'HOLD',target:{q:34,r:2},paused:true,risk:'LOW'};
 g.order={kind:'ADVANCE',target:{q:24,r:4},risk:'NORMAL',paused:false};
 for(const x of c.clock.corps.filter(g=>g.side==='GERMAN'&&g!==c.clock.corps[0]))x.order.paused=true;
 c.clock.autopause=false;c.observeVision();return {c,ids,enemy};
}
