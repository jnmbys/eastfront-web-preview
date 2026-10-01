import type {SliceData} from './mapData.js';
import {hexToPixel,type HexCoord} from '../geometry/hex.js';
import {makeEdge} from '../../vendor/eastfront-digital-core/dist/core/edge.js';

/** Synthetic layout laboratory, never imported into the real 640-cell map. */
export function createExpansionFixture(width=12,height=5,origin:HexCoord={q:64,r:0}):SliceData{
 const rows:SliceData['hexes'][number]['terrain'][][]=[
  ['FOREST','FOREST','FOREST','PLAIN','HILL','ROUGH','HILL','PLAIN','FOREST','PLAIN','FOREST','FOREST'],
  ['FOREST','PLAIN','HILL','PLAIN','HILL','FOREST','PLAIN','FOREST','FOREST','HILL','ROUGH','PLAIN'],
  ['CITY','CITY','CITY','PLAIN','CITY','MAIN_CITY','CITY','PLAIN','CITY','CITY','CITY','PLAIN'],
  ['PLAIN','CITY','PLAIN','FOREST','PLAIN','CITY','PLAIN','HILL','PLAIN','CITY','PLAIN','FOREST'],
  ['PLAIN','PLAIN','PLAIN','MARSH','PLAIN','PLAIN','PLAIN','PLAIN','PLAIN','PLAIN','PLAIN','PLAIN']
 ];
 const coord=(x:number,y:number)=>({q:origin.q+x,r:origin.r+y});
 const hexes:SliceData['hexes']=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width);return {coord:coord(x,y),terrain:rows[y%5]![x%12]!,control:null};});
 const edges:SliceData['edges']=[];
 // Continuous zigzag river along actual shared edges in this synthetic fixture.
 for(let x=0;x<width;x++)if(height>2){edges.push(makeEdge(coord(x,1),coord(x,2),{river:'MINOR',...(x===5?{road:true,bridge:{kind:'ROAD',destroyed:false}}:{})}));if(x<width-1)edges.push(makeEdge(coord(x+1,1),coord(x,2),{river:'MINOR'}));}
 for(let x=0;x<width-1;x++){if(height>2)edges.push(makeEdge(coord(x,2),coord(x+1,2),{road:true}));if(height>3)edges.push(makeEdge(coord(x,3),coord(x+1,3),{railway:{present:true,repairedBy:null,destroyed:false}}));}
 const counters:SliceData['counters']=height>3&&width>2?[0,1].map(i=>({id:'TEST-'+(i+1),side:'GERMAN',type:i?'ENGINEER':'INFANTRY',step:0,stats:{attack:3,defense:3,movement:4},hex:coord(1,3),supplyState:'SUPPLIED',controllerId:'GERMAN',selected:false,entrenched:false})):[];
 return {hexes,edges,counters};
}

export const expansionViews=[{id:'west',name:'街区 / 密林',coord:{q:66,r:2}},{id:'middle',name:'山脚 / 桥岸',coord:{q:70,r:2}},{id:'east',name:'疏林 / 街区',coord:{q:74,r:2}}];
/** Empty footprint reservations; not industrial buildings, commands or map data. */
export const industrialReservations=[{name:'工厂候选',coord:{q:65,r:4}},{name:'仓库候选',coord:{q:69,r:4}},{name:'站场候选',coord:{q:73,r:4}}].map(item=>({...item,center:hexToPixel(item.coord),width:38,height:20}));
