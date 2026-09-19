import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLocalGameSession} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
function render(){
  const session=createLocalGameSession(raw,17);
  const presentation=createPresentationState();
  const model=deriveBrowserRenderModel(session,presentation);
  return coreSvgMarkup(model,{debug:false,rendererMode:'production',assetSet:'p5',lod:'medium',scenarioSeed:17});
}

test('Safari compatibility: SVG root declares xlink namespace',()=>{
  const svg=render();
  assert.match(svg,/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]*xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/);
});

test('Safari compatibility: every production raster image has href and xlink:href to the same relative asset',()=>{
  const svg=render();
  const images=[...svg.matchAll(/<image\s+([^>]+)>/g)].map(m=>m[1]);
  assert(images.length>100,`expected substantial production image set, got ${images.length}`);
  for(const attrs of images){
    const href=attrs.match(/(?:^|\s)href="([^"]+)"/)?.[1];
    const xlink=attrs.match(/(?:^|\s)xlink:href="([^"]+)"/)?.[1];
    assert(href,'missing href');
    assert(xlink,'missing xlink:href');
    assert.equal(xlink,href);
    assert(href.startsWith('./assets/terrain/p4r3/'),href);
  }
});

test('Safari compatibility: per-Hex production clip ids are defined exactly once',()=>{
  const svg=render();
  const ids=[...svg.matchAll(/<clipPath id="(prodnclipn[^"]+)"/g)].map(m=>m[1]);
  assert.equal(ids.length,640);
  assert.equal(new Set(ids).size,640);
});

test('Strategic Reset F production renderer contains all release-critical terrain and infrastructure families',()=>{
  const svg=render();
  const required=[
    ['Forest','data-family="forest_mass"'],
    ['City','data-family="city_medium"'],
    ['Marsh','data-family="marsh_wet"'],
    ['Hill/Rough','data-family="hill_material"'],
    ['River','prod-river-water'],
    ['Road','prod-road'],
    ['Railway','prod-rail-ballast'],
    ['Bridge','prod-bridge'],
  ];
  for(const [label,marker] of required) assert(svg.includes(marker),`${label}: ${marker}`);
});
