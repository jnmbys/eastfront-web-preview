import {Campaign} from './authority.mjs';
export class RearFixture extends Campaign{territoryStrategy(){} }
export function setupRear(c){c.viewer='SOVIET';for(const g of c.clock.corps.filter(g=>g.side==='SOVIET'))c.transaction({id:'controlled-hold-'+g.id,version:c.version,operation:{type:'ORDER',group:g.id,order:{kind:'HOLD',target:structuredClone(c.state.units[g.members[0]].hex),risk:'NORMAL',paused:false}}});c.viewer='GERMAN';return c;}
