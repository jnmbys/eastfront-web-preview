import assert from 'node:assert/strict';
export const VERSION='HOI4-PROVINCE-001-1';
const SIDES=['GERMAN','SOVIET'],dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]],neighbors=k=>{const[q,r]=k.split(',').map(Number);return dirs.map(([x,y])=>`${q+x},${r+y}`);};
const sum=xs=>xs.reduce((a,b)=>a+b,0);
function distribute(total,rows,key){const weight=sum(rows.map(x=>x.cells.length));let given=0;for(let i=0;i<rows.length;i++){const n=i===rows.length-1?total-given:Math.floor(total*rows[i].cells.length/weight);rows[i][key]=n;given+=n;}}
/** One immutable geographic graph, persisted, not regenerated on camera/view/control changes. */
export function createProvinces(c){
 const owned=new Map(c.snapshot().continuous.geography.cells.map(x=>[x.hex,x.side]));
 const land=Object.keys(c.state.hexes).filter(k=>c.state.hexes[k].terrain!=='LAKE').sort();
 for(const k of land)if(!owned.has(k))owned.set(k,'NEUTRAL');
 const index={},items=[],queue=[];let serial=0;
 const add=(hex,name,placeId)=>{const owner=owned.get(hex);assert([...SIDES,'NEUTRAL'].includes(owner),'LAND_OWNER_REQUIRED');const id='P'+String(++serial).padStart(3,'0'),p={id,name:name+'省',owner,capital:hex,capitalPlace:placeId,cells:[],cities:[],population:0,reserve:0,eligible:0,locked:0,mobilizing:false,work:0,mobilized:0};items.push(p);index[hex]=id;queue.push(hex);return p;};
 // Capitals are existing gazetteer towns. No factory/hub/stock is created.
 for(const place of c.clock.mapPlaces)if(land.includes(place.hex)&&!index[place.hex])add(place.hex,place.name,place.id);
 const fill=()=>{for(let at=0;at<queue.length;at++){const k=queue[at];for(const n of neighbors(k))if(c.state.hexes[n]?.terrain!=='LAKE'&&owned.has(n)&&owned.get(n)===owned.get(k)&&!index[n]){index[n]=index[k];queue.push(n);}}};fill();
 for(const k of land)if(!index[k]){const name='边境'+(serial+1),place={id:'TOWN:'+k,cityId:null,name,hex:k,importance:0};c.clock.mapPlaces.push(place);add(k,name,place.id);fill();}
 for(const k of land)items.find(p=>p.id===index[k]).cells.push(k);
 for(const p of items){p.cities=c.clock.mapPlaces.filter(x=>index[x.hex]===p.id).map(x=>x.id);p.population=p.cells.length*2000;}
 const ledger=c.clock.divisionLedger;for(const side of SIDES){const rows=items.filter(p=>p.owner===side);assert.equal(ledger.nations[side].manpower,4800,'NEW_SCENARIO_RESERVE_4800');distribute(3600,rows,'reserve');distribute(1200,rows,'eligible');ledger.nations[side].manpower=3600;c.econ.modern.nations[side].manpower=3600;}
 ledger.provinceManpower={version:VERSION,held:{GERMAN:1200,SOVIET:1200}};
 const origins={};for(const[id,u]of Object.entries(ledger.units)){const h=c.state.units[id].hex,k=h.q+','+h.r;origins[id]=index[k]&&items.find(p=>p.id===index[k]).owner===u.side?index[k]:items.find(p=>p.owner===u.side).id;}
 const g={version:VERSION,items,index,origins,revision:{GERMAN:0,SOVIET:0},cursor:{GERMAN:0,SOVIET:0},lastTick:c.clock.tick};c.clock.provinces=g;validateProvinces(c);return g;
}
const controlled=(c,p)=>c.state.hexes[p.capital]?.control===p.owner;
/** Reconcile the provincial sub-ledger to the existing SINGLE national manpower pool.
 * It observes actual dispatch/returns; never sends people or bypasses transport. */
export function reconcileProvinces(c,returnOrigin){const g=c.clock.provinces;if(!g)return;const ledger=c.clock.divisionLedger;
 for(const side of SIDES){const rows=g.items.filter(p=>p.owner===side),n=ledger.nations[side];let delta=n.manpower-sum(rows.map(p=>p.reserve));
  if(delta<0){let remaining=-delta;for(const p of rows){const q=Math.min(p.reserve,remaining);p.reserve-=q;remaining-=q;}assert.equal(remaining,0,'PROVINCE_RESERVE_OVERDRAW');}
  else if(delta>0){const p=rows.find(p=>p.id===returnOrigin)??rows.find(p=>controlled(c,p))??rows[0];p.reserve+=delta;}
  for(const p of rows){if(!controlled(c,p)&&p.reserve){n.manpower-=p.reserve;p.locked+=p.reserve;p.reserve=0;}else if(controlled(c,p)&&p.locked){n.manpower+=p.locked;p.reserve+=p.locked;p.locked=0;}}
  ledger.provinceManpower.held[side]=sum(rows.map(p=>p.eligible+p.locked));c.econ.modern.nations[side].manpower=n.manpower;
 }
}
/** 100 persons/day per office, max 300/day per country; work is person-minutes.
 * Frozen finite 1200 eligibility pool, no regeneration on occupation or recapture. */
export function mobilizeStep(c){const g=c.clock.provinces;if(!g)return;reconcileProvinces(c);const elapsed=(c.clock.tick-g.lastTick)*5;if(elapsed<=0)return;assert(elapsed<=5,'PROVINCE_STEP_GAP');g.lastTick=c.clock.tick;
 for(const side of SIDES){const active=g.items.filter(p=>p.owner===side&&p.mobilizing&&p.eligible&&controlled(c,p)),rate=active.length?Math.min(100,300/active.length):0;for(const p of active){p.work+=rate*elapsed;const n=Math.min(p.eligible,Math.floor((p.work+1e-7)/1440));if(n){p.work=Math.max(0,p.work-n*1440);p.eligible-=n;p.reserve+=n;p.mobilized+=n;c.clock.divisionLedger.nations[side].manpower+=n;c.clock.divisionLedger.provinceManpower.held[side]-=n;}if(!p.eligible){p.mobilizing=false;p.work=0;}}}
 for(const side of SIDES)c.econ.modern.nations[side].manpower=c.clock.divisionLedger.nations[side].manpower;
 validateProvinces(c,false);
}
export function validateProvinces(c,geometry=true){const g=c.clock.provinces,p=c.clock.divisionLedger;assert.equal(g.version,VERSION);assert.equal(p.provinceManpower.version,VERSION);const seen=new Set();
 if(geometry)for(const row of g.items){assert(row.cells.includes(row.capital));assert(row.cities.includes(row.capitalPlace));for(const k of row.cells){assert(!seen.has(k));seen.add(k);assert.equal(g.index[k],row.id);assert(c.state.hexes[k]&&c.state.hexes[k].terrain!=='LAKE');}for(const k of ['reserve','eligible','locked','mobilized','population'])assert(Number.isSafeInteger(row[k])&&row[k]>=0,k);const connected=new Set([row.capital]),pending=[row.capital],set=new Set(row.cells);for(let i=0;i<pending.length;i++)for(const n of neighbors(pending[i]))if(set.has(n)&&!connected.has(n)){connected.add(n);pending.push(n);}assert.equal(connected.size,row.cells.length);}
 if(geometry)assert.equal(seen.size,Object.values(c.state.hexes).filter(h=>h.terrain!=='LAKE').length);
 for(const side of SIDES){const rows=g.items.filter(r=>r.owner===side);assert.equal(sum(rows.map(r=>r.reserve)),p.nations[side].manpower);assert.equal(sum(rows.map(r=>r.eligible+r.locked)),p.provinceManpower.held[side]);assert.equal(sum(rows.map(r=>r.eligible+r.mobilized)),1200);}
}
export function provinceView(c,d){const g=c.clock.provinces;if(!g)return null;const side=d.viewer,v=d.game.message.payload.view,identified=new Set(v.identifiedHexKeys),known=new Map(v.hexes.map(h=>[h.coord.q+','+h.coord.r,h.control])),ledger=c.clock.divisionLedger,m=d.modern;
 return {version:VERSION,revision:g.revision[side],rule:'有限战区适配：固定人口登记；原4800后备中3600可用、1200待征。每省100人/日、每国最多300人/日，省会失守暂停并冻结当地后备；不转归占领方。',items:g.items.map(p=>{
  const counts={GERMAN:0,SOVIET:0,NEUTRAL:0,unknown:0};for(const k of p.cells)counts[known.get(k)??(identified.has(k)?'NEUTRAL':'unknown')]++;const loss=(d.continuous.vision?.stale??[]).filter(h=>h.lost&&g.index[h.hex]===p.id);const capitalControl=known.get(p.capital)??(identified.has(p.capital)?'NEUTRAL':loss.some(h=>h.hex===p.capital)?'LOST':null);
  const result={id:p.id,name:p.name,owner:p.owner,capital:p.capital,capitalPlace:p.capitalPlace,cells:p.cells,cities:p.cities,population:p.population,control:counts,lost:loss.length,capitalControl,controller:counts.unknown?'UNKNOWN':counts.GERMAN===p.cells.length?'GERMAN':counts.SOVIET===p.cells.length?'SOVIET':counts.NEUTRAL===p.cells.length?'NEUTRAL':'CONTESTED',facilities:m.facilities.filter(f=>g.index[f.hex]===p.id).map(({id,hex,kind,damage})=>({id,hex,kind,damage})),sites:c.econ.modern.resourceSites.filter(x=>g.index[x.hex]===p.id&&c.state.hexes[x.hex].control===side).map(x=>structuredClone(x)),hubs:m.network.hubs.filter(h=>g.index[h.hex]===p.id).map(({id,hex,level,used,capacity,route})=>({id,hex,level,used,capacity,connected:!!route})),rails:m.rails.filter(r=>g.index[r.a]===p.id).map(({id,a,b,level,damage})=>({id,a,b,level,damage})),resources:{}};
  // Only authorized resource-site facts. National production remains the existing allocator.
  for(const x of result.sites)for(const[k,q]of Object.entries(x.capacity??{}))result.resources[k]=(result.resources[k]??0)+q;
  if(p.owner===side){result.manpower={reserve:p.reserve,eligible:p.eligible,locked:p.locked,mobilized:p.mobilized,mobilizing:p.mobilizing,work:p.work,enlisted:sum(Object.values(ledger.units).filter(u=>g.origins[u.id]===p.id).map(u=>u.personnel)),reason:!controlled(c,p)?'省会失守，征集与当地后备冻结':!p.eligible?'本轮可征集额度耗尽':p.mobilizing?'按游戏时间调集，完成后才加入国家后备':'未调集'};}
  return result;
 })};
}
