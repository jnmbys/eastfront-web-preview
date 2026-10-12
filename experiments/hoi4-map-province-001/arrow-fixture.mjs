import {Campaign} from './authority.mjs';
export class ArrowFixture extends Campaign {
 constructor(){super();for(const g of this.clock.corps)g.order.paused=true;
  // Directed initial deployment only; unchanged men, equipment, damage and movement rules.
  const positions={'G-029':{q:25,r:4},'G-030':{q:25,r:5},'S-029':{q:26,r:4}};
  for(const[id,h]of Object.entries(positions)){this.state.units[id].hex=h;this.clock.units[id].hex=structuredClone(h);this.clock.units[id].direct={kind:id.startsWith('G')?'ATTACK':'HOLD',target:{q:26,r:4},risk:'NORMAL',paused:false};}
  this.observeVision();this.clock.autopause=false;this.clock.paused=false;
  for(let i=0;i<6&&!this.snapshot().continuous.map.battles.length;i++)this.advance();
  this.clock.paused=true;
 }
}
if(process.argv[1]?.endsWith('arrow-fixture.mjs')){const c=new ArrowFixture();console.log(JSON.stringify({tick:c.clock.tick,battles:c.snapshot().continuous.map.battles.map(({id,hex,attackDirections,actions})=>({id,hex,attackDirections,actions})),actions:c.snapshot().continuous.map.actions},null,2));}
