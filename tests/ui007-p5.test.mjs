import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createLocalGameSession} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
const sha=async url=>createHash('sha256').update(await readFile(url)).digest('hex');
const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));

test('UI007R1 runtime preserves UI007 P5 provenance except the authorized P5R1 S02 micro-fix',async()=>{
  const runtime=new URL('../public/assets/terrain/p4r3/',import.meta.url), baseline=new URL('../public/dev-assets/terrain/p4r3-baseline/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('manifest.json',runtime),'utf8'));
  const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))].sort();
  assert.equal(refs.length,123);
  const lines=(await readFile(new URL('../docs/p5-handoff/P5_ASSET_HASHES.csv',import.meta.url),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  const expected=new Map(lines.slice(1).map(line=>{const c=line.split(',');return [c[0],{p4:c[3],p5:c[4]}]}));
  const p5r1=JSON.parse(await readFile(new URL('../docs/p5r1-handoff/P5R1_CHANGED_ASSETS.json',import.meta.url),'utf8')).changedProductionAssets[0];
  let changed=0,unchanged=0;
  for(const rel of refs){const exp=expected.get(rel);assert(exp,rel);const rs=await sha(new URL(rel,runtime)), bs=await sha(new URL(rel,baseline));
    assert.equal(rs,rel===p5r1.file?p5r1.afterSHA256:exp.p5,`runtime ${rel}`);assert.equal(bs,exp.p4,`P4R3 ${rel}`);rs===bs?unchanged++:changed++;}
  assert.equal(changed,73);assert.equal(unchanged,50);
  assert.equal(await sha(new URL('manifest.json',runtime)),await sha(new URL('manifest.json',baseline)));
});

test('UI007 active runtime contains only manifest production rasters plus manifest',async()=>{
  const runtime=new URL('../public/assets/terrain/p4r3/',import.meta.url);const manifest=JSON.parse(await readFile(new URL('manifest.json',runtime),'utf8'));
  const refs=new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]));
  async function walk(url,prefix=''){let out=[];for(const d of await readdir(url,{withFileTypes:true})){const rel=prefix?`${prefix}/${d.name}`:d.name;if(d.isDirectory())out.push(...await walk(new URL(`${d.name}/`,url),rel));else out.push(rel);}return out;}
  const files=(await walk(runtime)).sort();assert.deepEqual(files.filter(x=>x!=='manifest.json'),[...refs].sort());assert(!files.some(x=>/demo|review|non_authoritative/i.test(x)));
});

test('UI007 P4R3/P5 A-B asset switch is presentation-only and preserves canonical markup structure',()=>{
  const s=createLocalGameSession(raw,17),p=createPresentationState();const before=JSON.stringify(s.state),m=deriveBrowserRenderModel(s,p);
  const p5=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'medium',scenarioSeed:17});
  p.productionAssetSet='p4r3';const old=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p4r3',lod:'medium',scenarioSeed:17});
  assert.equal(JSON.stringify(s.state),before);assert(p5.includes('/assets/terrain/p4r3/'));assert(old.includes('/dev-assets/terrain/p4r3-baseline/'));
  assert.equal((p5.match(/data-grid-hex=/g)||[]).length,640);assert.equal((old.match(/data-grid-hex=/g)||[]).length,640);
  assert.equal((p5.match(/data-unit-id=/g)||[]).length,(old.match(/data-unit-id=/g)||[]).length);
});

test('UI007 locked geometry hash remains unchanged',async()=>{assert.equal(await sha(new URL('../src/geometry/hex.ts',import.meta.url)),'283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a');});
