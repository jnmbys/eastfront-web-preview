import {readFileSync,writeFileSync} from 'node:fs';
import {renderCounter} from '../../dist/app/render/coreSvg.js';
const types=['INFANTRY','PANZER','ARTILLERY','ENGINEER','RECON','ANTI_TANK'];
const css=readFileSync('styles.css','utf8');let body='';
for(let row=0;row<4;row++)for(let col=0;col<6;col++){
 const type=types[col],step=row===2?1:row===3?2:0,side=row%2?'SOVIET':'GERMAN';
 const c={id:`${side==='GERMAN'?'G':'S'}-${col+1}`,side,type,step,stats:{attack:5,defense:3,movement:4},supplyState:row===3?'OUT_OF_SUPPLY':'SUPPLIED',hex:{q:0,r:0},selected:row===2,entrenched:row===3&&col===0};
 body+=`<g transform="translate(${100+col*170} ${105+row*165}) scale(2)">${renderCounter(c,0,1)}</g><text x="${100+col*170}" y="${173+row*165}" text-anchor="middle" fill="#d2c5ad" font-size="12">${type}</text>`;
}
body+=`<text x="35" y="740" fill="#d6c8af" font-size="15">Stack of 2 · unchanged placement / shared canonical anchor</text>`;
const c={id:'G-STACK',side:'GERMAN',type:'INFANTRY',step:0,stats:{attack:5,defense:3,movement:4},supplyState:'SUPPLIED',hex:{q:0,r:0},selected:false,entrenched:false};
body+=`<g transform="translate(640 753) scale(2)">${renderCounter(c,0,2)}${renderCounter({...c,id:'G-STACK-2',type:'PANZER'},1,2)}</g>`;
writeFileSync('evidence/counter-v2/COUNTER-V2.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="840" viewBox="0 0 1080 840"><style>${css}</style><rect width="1080" height="840" fill="#121c28"/><text x="35" y="30" fill="#efdfbd" font-size="19">Counter V2 · presentation fixtures (illustrative values, enlarged 2×)</text>${body}</svg>`);
