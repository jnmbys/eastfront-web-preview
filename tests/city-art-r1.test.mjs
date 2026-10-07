import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {staticGrandGeometry} from '../dist/app/render/grandArtGeometry.js';
import {paintCities} from '../dist/app/playable/cities.js';
import {terrainSurfacePlan} from '../dist/app/render/terrainSurface.js';
import {buildGeography} from '../experiments/grand-campaign-003/scenario.mjs';
const base='37eae5148f8175574dba91e03c14346a1ea3a733';
const art='fff0a15702fc6a7dae13811170d75e60487ec281';
test('CITY R1 preserves canonical map/assets and unified gameplay modules',()=>{
 for(const [ref,paths] of [[art,['experiments/grand-campaign-003/scenario.mjs','experiments/grand-campaign-003/terrain.json','public/assets']],[base,['vendor','experiments','src/playable','src/core-adapter','ai','server']]])
  assert.equal(execFileSync('git',['diff',ref,'--',...paths],{encoding:'utf8'}),'');
});
test('cached terrain excludes all dynamic fields and detaches geometry',()=>{
 const map=buildGeography().map;
 const live={hexes:map.hexes.map(h=>({...h,control:'GERMAN',visible:true,facilities:[{id:'F',status:'BUILT'}]})),edges:map.edges.map(e=>({...e,control:'GERMAN',active:true})),units:[{id:'G'}],viewerSide:'GERMAN',cities:{secret:true}};
 const frozen=staticGrandGeometry(live),before=JSON.stringify(frozen);
 assert.deepEqual(Object.keys(frozen).sort(),['edges','hexes']);
 assert(frozen.hexes.every(h=>Object.keys(h).sort().join(',')==='coord,terrain'));
 assert(frozen.edges.every(e=>!('control'in e)&&!('active'in e)));
 live.hexes[0].coord.q+=100;live.hexes[0].control='SOVIET';live.hexes[0].facilities=[];live.edges[0].a.q+=100;
 const rail=live.edges.find(e=>e.railway),bridge=live.edges.find(e=>e.bridge);
 rail.railway.repairedBy='SOVIET';rail.railway.destroyed=true;bridge.bridge.destroyed=true;
 assert(frozen.edges.every(e=>!e.railway||Object.keys(e.railway).join(',')==='present'));
 assert(frozen.edges.every(e=>!e.bridge||Object.keys(e.bridge).join(',')==='kind'));
 assert.equal(JSON.stringify(frozen),before);
 assert.equal(frozen.hexes.length,1280);
 const plans=['far','medium','close'].map(l=>terrainSurfacePlan(frozen,17,l));
 assert(plans.every(p=>p.assetFiles.every(f=>!f.includes('dev-assets'))));
});
test('actual factory overlay follows authorized facilities and replaces previous layer',()=>{
 const old=globalThis.document;let markup='',removed=0;
 const svg={querySelector:()=>({remove(){removed++;markup='';}}),addEventListener(){},querySelectorAll:()=>[],insertAdjacentHTML(_where,html){markup=html;}};
 globalThis.document={querySelector:()=>svg};
 const district={id:'D',hex:'0,0',paper:'A1',type:'INDUSTRIAL',control:'GERMAN',facilities:[{id:'F1',status:'BUILT'},{id:'F2',status:'BUILDING'}]};
 const p={data:{cities:{items:[{id:'C',label:'City',districts:[district]}]}}};
 try {paintCities(p,()=>{});assert.equal((markup.match(/data-facility-id=/g)||[]).length,1);assert(markup.includes('F1'));assert(!markup.includes('data-facility-id="F2"'));
 district.facilities[1].status='BUILT';paintCities(p,()=>{});assert.equal((markup.match(/data-facility-id=/g)||[]).length,2);
 district.control=null;district.facilities=[];paintCities(p,()=>{});assert(!markup.includes('data-facility-id='));assert.equal(removed,3);
 }finally{globalThis.document=old;}
});
test('CITY explicitly disables decorative factory silhouettes; other modes retain default',()=>{
 const main=readFileSync('src/main.ts','utf8'),world=readFileSync('src/render/vs2TerrainSurface.ts','utf8');
 assert(main.includes('createVS2TerrainSurfaceHooks(undefined,control,2,true,false)'));
 assert(world.includes('decorativeIndustry=true'));
 assert(world.includes('.filter(b=>decorativeIndustry||!b.industrial)'));
 assert(main.includes('staticGrandGeometry(model)'));
});
