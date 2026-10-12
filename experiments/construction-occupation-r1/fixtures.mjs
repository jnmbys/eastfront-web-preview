import {Campaign} from './authority.mjs';
import {construction} from '../grand-economy-002/economy.mjs';
let id=0;export const command=(c,operation)=>c.transaction({id:'occupation-check-'+ ++id,version:c.version,operation});
export function control(c,cells,side){for(const k of cells)c.state.hexes[k].control=side;c.version++;c.match.matchRevision=c.version;}
export function site(c,kind){if(kind==='INFRA'){const p=c.clock.provinces.items.find(p=>p.cells.every(k=>c.state.hexes[k].control==='GERMAN'));return {target:p.id,cells:p.cells,level:c.clock.infrastructure.levels[p.id]};}if(kind==='FORT'){const h=c.snapshot().modern.forts.find(f=>f.canBuild);return {target:h.hex,cells:[h.hex],level:h.level};}const d=c.snapshot().modern.sites.find(s=>s.free);return {target:d.id,cells:[d.hex],free:d.free};}
export function enemyFixture(kind,count=1){const c=new Campaign(),s=site(c,kind);control(c,s.cells,'SOVIET');c.viewer='SOVIET';for(let i=0;i<count;i++)command(c,{type:'ECON_BUILD',kind,target:s.target});for(let i=0;i<12;i++)construction(c);control(c,s.cells,'GERMAN');c.viewer='GERMAN';return {c,s};}
export function finishOwned(c,side){let steps=0;while(c.econ.modern.queue.some(q=>q.side===side&&q.status!=='DONE')&&steps++<100000)construction(c);if(steps>=100000)throw Error('COMPONENT_BUDGET');return steps;}
