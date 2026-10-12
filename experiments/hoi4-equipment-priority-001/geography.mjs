import assert from 'node:assert/strict';
import {validateProvinces} from '../hoi4-map-province-001/provinces.mjs';
export const MAP_VERSION='SMOLENSK-HINTERLAND-001-1';
// Display-name adaptation only: existing coordinates are NOT a historical projection.
export const gazetteer=[
 ['CITY-WEST-WORKS','奥尔沙','Orsha'],['CITY-DNIEPER','斯摩棱斯克','Smolensk'],['CITY-SOUTH-FERRY','罗斯拉夫尔','Roslavl'],
 ['CITY:GERMAN-industry-1','维捷布斯克','Vitebsk'],['CITY:GERMAN-industry-2','利奥兹诺','Liozno'],['CITY:GERMAN-industry-4','莫吉廖夫','Mogilev'],['CITY:GERMAN-industry-5','克里切夫','Krichev'],
 ['CITY:GERMAN-depot-1','韦利日','Velizh'],['CITY:GERMAN-depot-2','鲁德尼亚','Rudnya'],['CITY:GERMAN-depot-3','克拉斯内','Krasny'],['CITY:GERMAN-depot-4','姆斯季斯拉夫尔','Mstislavl'],['CITY:GERMAN-depot-5','克利莫维奇','Klimovichi'],
 ['CITY:SOVIET-industry-1','别雷','Bely'],['CITY:SOVIET-industry-2','瑟乔夫卡','Sychevka'],['CITY:SOVIET-industry-3','亚尔采沃','Yartsevo'],['CITY:SOVIET-industry-4','叶利尼亚','Yelnya'],['CITY:SOVIET-industry-5','斯帕斯杰缅斯克','Spas-Demensk'],
 ['CITY:SOVIET-depot-1','杜霍夫希纳','Dukhovshchina'],['CITY:SOVIET-depot-2','卡尔德莫沃','Kardymovo'],['CITY:SOVIET-depot-4','波奇诺克','Pochinok'],['CITY:SOVIET-depot-5','舒米亚奇','Shumyachi'],['CITY:EAST-CAPITAL','维亚济马','Vyazma'],['CITY:OBJECTIVE-5','杰米多夫','Demidov'],
 ['TOWN:3,10','先诺','Senno'],['TOWN:9,0','苏拉日','Surazh (Vitebsk)'],['TOWN:15,5','杜布罗夫诺','Dubrovno'],['TOWN:16,14','戈尔基','Gorki (Mogilev)'],['TOWN:31,-2','萨福诺沃','Safonovo'],['TOWN:32,8','多罗戈布日','Dorogobuzh'],['TOWN:30,-13','霍尔姆日尔科夫斯基','Kholm-Zhirkovsky'],['TOWN:23,20','希斯拉维奇','Khislavichi']
];
const key=h=>h.q+','+h.r,dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],near=k=>{const[q,r]=k.split(',').map(Number);return dirs.map(([a,b])=>`${q+a},${r+b}`);};
const terrain={PLAIN:10,CITY:10,MAIN_CITY:10,FOREST:17,HILL:23,MARSH:36};
/** Deterministic settlement catchments, not noise or current control/vision. Run ONLY at creation. */
export function createRegionalMap(c){
 const g=c.clock.provinces,old={...g.index},byId=new Map(g.items.map(p=>[p.id,p])),owner=k=>byId.get(old[k])?.owner,edge=new Map();
 for(const e of Object.values(c.state.edges)){edge.set([key(e.a),key(e.b)].sort().join('|'),e);}
 const names=new Map(gazetteer.map(([id,name,latin])=>[id,{name,latin}]));
 for(const p of c.clock.mapPlaces){assert(names.has(p.id),'UNMAPPED_PLACE '+p.id);Object.assign(p,names.get(p.id));}
 const index={},heap=[];let serial=0;
 const push=x=>{x.serial=serial++;heap.push(x);heap.sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id)||a.serial-b.serial);};
 for(const p of g.items){index[p.capital]=p.id;push({k:p.capital,id:p.id,d:0,capital:true});p.cells=[];p.name=names.get(p.capitalPlace).name+'地区';}
 while(heap.length){const x=heap.shift();if(!x.capital){if(index[x.k])continue;index[x.k]=x.id;}
  for(const n of near(x.k)){if(!old[n]||index[n]||owner(n)!==byId.get(x.id).owner)continue;const e=edge.get([x.k,n].sort().join('|'));let cost=(terrain[c.state.hexes[x.k].terrain]+terrain[c.state.hexes[n].terrain])/2;
   if(e?.road)cost*=.65;else if(e?.railway?.present)cost*=.85;
   if(e?.river)cost+=e.bridge?8:45;
   push({k:n,id:x.id,d:x.d+cost});
  }
 }
 assert.equal(Object.keys(index).length,Object.keys(old).length,'ALL_LAND_ASSIGNED');g.index=index;
 for(const k of Object.keys(old))byId.get(index[k]).cells.push(k);
 for(const p of g.items){p.cells.sort();p.cities=c.clock.mapPlaces.filter(x=>index[x.hex]===p.id).map(x=>x.id);p.population=p.cells.length*2000;}
 // Initial registers and infrastructure levels remain on permanent province IDs: no new manpower or level grants.
 for(const[id,u]of Object.entries(c.clock.divisionLedger.units)){const k=key(c.state.units[id].hex);g.origins[id]=owner(k)===u.side?index[k]:g.items.find(p=>p.owner===u.side).id;}
 c.clock.infrastructure.index={...index};c.clock.regionalMap={version:MAP_VERSION,region:'1941年斯摩棱斯克及维捷布斯克—奥尔沙—莫吉廖夫周边；抽象地图适配，非历史坐标/行政边界',changedCells:Object.keys(old).filter(k=>old[k]!==index[k]).length};
 validateProvinces(c);
}
export function regionalView(c,d){if(!c.clock.regionalMap)return;d.regionalMap=structuredClone(c.clock.regionalMap);const names=new Map(c.clock.mapPlaces.map(p=>[p.id,p.name]));for(const city of d.cities?.items??[])city.label=names.get(city.id)??city.label;}
