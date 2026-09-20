import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TerrainSurfaceResourceError,formatTerrainSurfaceFailure} from '../dist/app/render/terrainSurface.js';

const source=await readFile(new URL('../src/render/terrainSurface.ts',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');

test('UI009R2D2 startup loader uses direct URL image first with optional fetch/bitmap fallback',()=>{
  assert(source.includes("capabilities.createImageBitmap"));
  assert(source.includes("imageFromUrl(url,entry,'direct-image-load'"));
  assert(source.includes("fetchTerrainBlobWithAbort(url,entry,capabilities)"));
  assert(source.includes("imageFromUrl(objectUrl,entry,'html-image-load'"));
  assert.equal(source.includes("cache:'force-cache'"),false);
  assert(source.indexOf("imageFromUrl(url,entry,'direct-image-load'") < source.indexOf("fetchTerrainBlobWithAbort(url,entry,capabilities)"));
  assert.equal(source.includes('.decode()'),false,'HTMLImageElement.decode must not be mandatory');
});

test('UI009R2 startup resource failures preserve exact URL asset family HTTP stage and capabilities',()=>{
  const error=new TerrainSurfaceResourceError('x',{stage:'http',url:'https://example.test/city.png',assetId:'S02',family:'city_small',httpStatus:503,preferredApi:'fetch',cause:'test',capabilities:{createImageBitmap:false,offscreenCanvas:false,htmlImageDecode:true,canvas2d:true}});
  const text=formatTerrainSurfaceFailure(error);
  for(const part of ['stage=http','asset=S02','family=city_small','url=https://example.test/city.png','http=503','createImageBitmap:false','OffscreenCanvas:false','HTMLImageElement.decode:true','Canvas2D:true'])assert(text.includes(part),part);
});

test('UI009R2 production fatal screen exposes startup detail instead of generic-only resource failure',()=>{
  assert(main.includes('formatTerrainSurfaceFailure(error)'));
  assert(main.includes("phase='static-terrain-surface'"));
  assert(main.includes("fatalMessage=msg('game.resourceFailure',{detail})"));
  assert(main.includes("console.error('EASTFRONT startup failed',diagnostic,error)"));
});
