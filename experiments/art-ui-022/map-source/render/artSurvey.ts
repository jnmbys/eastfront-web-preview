import {relief} from './artRelief.js';
/** ART-PROTOTYPE-001: presentation only; consumes the authorized projection. */
import type {BrowserRenderModel} from './coreModel.js';
import {hexToPixel,polygonPointsString,sharedHexEdge} from '../geometry/hex.js';
import {deriveBridgeGeometry} from './derive.js';
const esc=(s:string)=>s.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
export function surveyTerrain(model:BrowserRenderModel):string {
 return `<g id="art-survey-terrain">${model.hexes.map(h=>{
 const {x,y}=hexToPixel(h.coord),t=h.terrain;
 let symbol='';
 if(t==='FOREST')symbol='<path d="M-17 8l7-17 7 17Z M1 8l7-21 8 21Z"/>';
 if(t==='HILL'||t==='ROUGH')symbol='<path d="M-23 12Q-18-18 0-12Q21-10 24 12 M-16 10Q-10-9 2-5Q12-3 16 10 M-7 8Q0-2 7 8"/>'+(t==='ROUGH'?'<path d="M-18-17l5-6 4 6m15 0l5-6 4 6"/>':'');
 if(t==='MARSH')symbol='<path d="M-22 9h17m8 0h17M-16-3h12m8 0h12M-9 7V-8m-4 2 4 4 4-4M10 6V-8m-4 2 4 4 4-4"/>';
 if(t==='LAKE')symbol='<path d="M-20-6q10-5 20 0t20 0M-20 6q10-5 20 0t20 0"/>';
 if(t.includes('CITY'))symbol='<path d="M-16-12h12V1h-12Zm17-7h14V-3H1ZM-9 6H8V17H-9Z"/>';
 return `<g data-hex="${h.coord.q},${h.coord.r}" data-art-terrain="${t}"><polygon points="${polygonPointsString(h.coord)}" class="art-ground art-${t}"/><g class="art-relief-detail" transform="translate(${x} ${y})">${relief[t]?.[Math.abs(h.coord.q*37+h.coord.r*61)%4]??''}</g><g class="art-symbol art-symbol-${t}" transform="translate(${x} ${y})">${symbol}</g></g>`;
 }).join('')}</g>`;
}
export function surveyNetwork(model:BrowserRenderModel):string {
 const line=(a:{x:number;y:number},b:{x:number;y:number},cls:string,key:string)=>`<path data-art-edge="${esc(key)}" d="M${a.x} ${a.y}L${b.x} ${b.y}" class="${cls}"/>`;
 const rivers=model.edges.filter(e=>e.river).map(e=>{const p=sharedHexEdge(e.a,e.b);if(!p)throw Error('Invalid river adjacency '+e.key);return {e,p};});
 // Complete casing pass FIRST. Later segment casings cannot punch false gaps in water.
 const water=rivers.map(({e,p})=>line(p[0],p[1],'art-river-case',e.key)).join('')+rivers.map(({e,p})=>line(p[0],p[1],e.river==='MAJOR'?'art-river art-major':'art-river',e.key)).join('');
 const roads=model.edges.filter(e=>e.road).map(e=>line(hexToPixel(e.a),hexToPixel(e.b),'art-road',e.key)).join('');
 const rails=model.edges.filter(e=>e.railway?.present).map(e=>line(hexToPixel(e.a),hexToPixel(e.b),'art-rail',e.key)+line(hexToPixel(e.a),hexToPixel(e.b),'art-sleepers',e.key)).join('');
 const bridges=model.edges.filter(e=>e.bridge).map(e=>{const g=deriveBridgeGeometry(e.a,e.b),d=e.bridge!.destroyed;
 return `<g data-art-bridge="${esc(e.key)}" data-destroyed="${d}">${d?`<path class="art-destroyed" d="M${g.crossing.x-7} ${g.crossing.y-7}l14 14m-14 0 14-14"/>`:line(g.from,g.to,'art-bridge-case',e.key)+line(g.from,g.to,'art-bridge',e.key)}</g>`;}).join('');
 return `<g id="art-network" pointer-events="none">${roads}${rails}${water}${bridges}</g>`;
}
export function surveyMarkup(model:BrowserRenderModel):string{return surveyTerrain(model)+surveyNetwork(model);}
