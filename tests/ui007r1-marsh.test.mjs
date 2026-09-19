import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createLocalGameSession} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {marshContinuityDecision} from '../dist/app/render/productionTerrain.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const dirs=[[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const fresh=(seed=17)=>createLocalGameSession(raw,seed);
const key=c=>`${c.q},${c.r}`;
const edgeId=(a,b)=>key(a)<key(b)?`${key(a)}|${key(b)}`:`${key(b)}|${key(a)}`;
function render(seed=17,lod='medium'){const s=fresh(seed),p=createPresentationState(),m=deriveBrowserRenderModel(s,p);return {s,m,svg:coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod,scenarioSeed:seed})};}
function adjacencyPairs(m,left,right){const tm=new Map(m.hexes.map(h=>[key(h.coord),h.terrain]));const out=[];const seen=new Set();for(const h of m.hexes){if(h.terrain!==left)continue;for(const [dq,dr] of dirs){const b={q:h.coord.q+dq,r:h.coord.r+dr};if(tm.get(key(b))!==right)continue;const id=edgeId(h.coord,b);if(seen.has(id))continue;seen.add(id);out.push([h.coord,b]);}}return out;}
function renderedEdgeIds(svg){return new Set([...svg.matchAll(/data-marsh-edge="([^"]+)"/g)].map(m=>m[1]));}

test('UI007R1 Marsh-Marsh continuity decision is deterministic and unordered-edge stable',()=>{
  const {m}=render();const pairs=adjacencyPairs(m,'MARSH','MARSH');assert(pairs.length>0);
  for(const [a,b] of pairs){assert.deepEqual(marshContinuityDecision(17,a,b),marshContinuityDecision(17,a,b));assert.deepEqual(marshContinuityDecision(17,a,b),marshContinuityDecision(17,b,a));}
});

test('UI007R1 same visual seed produces identical Marsh continuity markup',()=>{
  const a=render(17,'medium').svg,b=render(17,'medium').svg;assert.equal(a,b);assert(a.includes('production-marsh-continuity-layer'));
});

test('UI007R1 alternate visual seed can legally vary Marsh continuity without touching terrain semantics',()=>{
  const base=render(17,'medium'),pairs=adjacencyPairs(base.m,'MARSH','MARSH');let variantSeed=null;
  for(let seed=18;seed<80&&!variantSeed;seed++){if(pairs.some(([a,b])=>marshContinuityDecision(seed,a,b).wet!==marshContinuityDecision(17,a,b).wet))variantSeed=seed;}
  assert(variantSeed!==null,'expected at least one alternate deterministic continuity pattern');
  const alt=render(variantSeed,'medium');assert.notDeepEqual(renderedEdgeIds(base.svg),renderedEdgeIds(alt.svg));
});

test('UI007R1 Marsh-Plain boundaries never receive continuity geometry',()=>{
  const {m,svg}=render(17,'medium'),edges=renderedEdgeIds(svg),pairs=adjacencyPairs(m,'MARSH','PLAIN');assert(pairs.length>0);for(const [a,b] of pairs)assert.equal(edges.has(edgeId(a,b)),false,edgeId(a,b));
});

test('UI007R1 Marsh-Forest boundaries never receive continuity geometry',()=>{
  const {m,svg}=render(17,'medium'),edges=renderedEdgeIds(svg),pairs=adjacencyPairs(m,'MARSH','FOREST');assert(pairs.length>0);for(const [a,b] of pairs)assert.equal(edges.has(edgeId(a,b)),false,edgeId(a,b));
});

test('UI007R1 Marsh continuity rendering is presentation-only and never mutates GameState',()=>{
  const s=fresh(17),p=createPresentationState(),m=deriveBrowserRenderModel(s,p),before=JSON.stringify(s.state);coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'medium',scenarioSeed:17});assert.equal(JSON.stringify(s.state),before);
});

test('UI007R1 LOD changes Marsh detail only, not continuity decisions or GameState',()=>{
  const s=fresh(17),p=createPresentationState(),m=deriveBrowserRenderModel(s,p),before=JSON.stringify(s.state);
  const far=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'far',scenarioSeed:17});
  const medium=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'medium',scenarioSeed:17});
  const close=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod:'close',scenarioSeed:17});
  assert.deepEqual(renderedEdgeIds(far),renderedEdgeIds(medium));assert.deepEqual(renderedEdgeIds(medium),renderedEdgeIds(close));
  assert(!far.includes('marsh-reed-continuity'));assert(close.includes('marsh-reed-continuity'));assert.equal(JSON.stringify(s.state),before);
});

test('UI007R1 Marsh continuity stays below grid, tactical overlays and counters',()=>{
  const {svg}=render(17,'medium');const continuity=svg.indexOf('production-marsh-continuity-layer'),grid=svg.indexOf('production-grid-layer'),deployment=svg.indexOf('deployment-zone-layer'),counters=svg.indexOf('counter-layer');
  assert(continuity>=0&&grid>continuity&&deployment>grid&&counters>deployment);
});

test('UI007R1 locked Geometry SHA remains unchanged',async()=>{
  const sha=createHash('sha256').update(await readFile(new URL('../src/geometry/hex.ts',import.meta.url))).digest('hex');assert.equal(sha,'283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a');
});
