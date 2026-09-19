import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createLocalGameSession} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const runtime=new URL('../public/assets/terrain/p4r3/',import.meta.url);
const change=JSON.parse(await readFile(new URL('../docs/p5r1-handoff/P5R1_CHANGED_ASSETS.json',import.meta.url),'utf8'));
const sha=async url=>createHash('sha256').update(await readFile(url)).digest('hex');

function p5HashMap(){return readFile(new URL('../docs/p5-handoff/P5_ASSET_HASHES.csv',import.meta.url),'utf8').then(text=>{
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  return new Map(lines.slice(1).map(line=>{const c=line.split(',');return [c[0],c[4]];}));
});}

function sameCoord(a,b){return a.q===b.q&&a.r===b.r;}
function targetCell(svg,key){const marker=`data-hex="${key}"`;const start=svg.indexOf(marker);assert(start>=0,`missing ${key}`);const next=svg.indexOf('data-hex="',start+marker.length);return svg.slice(start,next<0?svg.length:next);}

test('UI007R1 runtime S02 hash equals P5R1 micro-fix and manifest contract remains byte-identical',async()=>{
  const changed=change.changedProductionAssets;
  assert.equal(changed.length,1);
  assert.equal(changed[0].file,'city/small/S02.png');
  assert.equal(await sha(new URL(changed[0].file,runtime)),changed[0].afterSHA256);
  assert.equal(changed[0].beforeSHA256,'548ab5333ab4d85d50b2e0317cd9394fddd5ffe38895b3603b96230c665ec5ae');
  assert.equal(await sha(new URL('manifest.json',runtime)),'5e2ac4521b889e92d9b77a75b47c87075c8aeab9f43acd112ef91de7e6b82936');
  assert.equal(change.manifestByteIdentical,true);
});

test('UI007R1 other 122 production rasters remain byte-identical to P5 baseline',async()=>{
  const expected=await p5HashMap();
  const manifest=JSON.parse(await readFile(new URL('manifest.json',runtime),'utf8'));
  const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))].sort();
  assert.equal(refs.length,123);
  let unchanged=0;
  for(const rel of refs){
    if(rel==='city/small/S02.png')continue;
    assert.equal(await sha(new URL(rel,runtime)),expected.get(rel),rel);
    unchanged++;
  }
  assert.equal(unchanged,122);
  assert.equal(expected.get('city/small/S02.png'),change.changedProductionAssets[0].beforeSHA256);
});

test('UI007R1 OUTER_CITY 29,-5 has no canonical Road, keeps Railway, and renders S02 through normal city selection',()=>{
  const session=createLocalGameSession(raw,17),presentation=createPresentationState(),model=deriveBrowserRenderModel(session,presentation),target={q:29,r:-5};
  const hex=model.hexes.find(h=>sameCoord(h.coord,target));
  assert(hex,'target hex');assert.equal(hex.terrain,'OUTER_CITY');
  const incident=model.edges.filter(e=>sameCoord(e.a,target)||sameCoord(e.b,target));
  assert(incident.length>0);
  assert.equal(incident.some(e=>Boolean(e.road)),false,'no canonical Road may touch OUTER_CITY 29,-5');
  assert.equal(incident.some(e=>Boolean(e.railway?.present)),true,'Railway must remain present');
  const svg=coreSvgMarkup(model,{debug:false,rendererMode:'production',assetSet:'p5',lod:'close',scenarioSeed:17});
  const cell=targetCell(svg,'29,-5');
  assert(cell.includes('data-family="city_small"'));
  assert(cell.includes('data-asset-id="S02"'));
});
