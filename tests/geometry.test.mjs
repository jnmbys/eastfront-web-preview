import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  HEX_SIZE, EPSILON, hexDistance, hexLine, hexNeighbors, hexPolygon, hexToPixel,
  offsetToAxial, polygonPointsString, sharedHexEdge,
} from '../dist/app/geometry/hex.js';
import { attackTargetHexes, bridgeEdges, enemyZocHexes, initialSelectedUnitId, railPath, reachableHexes, riverEdges, roadPath, units } from '../dist/app/model/prototypeData.js';
import {
  SELECTED_VISUAL_SCALE, TOUCH_HIT_SIZE, deriveBridgeGeometry, deriveCounterPlacement,
  deriveOverlayPolygon, deriveRiverEdge, deriveTargetBrackets, deriveTouchHitArea,
} from '../dist/app/render/derive.js';
import { MAP_VIEWBOX, makePath, svgMarkup } from '../dist/app/render/svg.js';

const near=(a,b)=>Math.abs(a-b)<EPSILON;
const pointNear=(a,b)=>near(a.x,b.x)&&near(a.y,b.y);

// UI-001 regression suite (18 tests) — intentionally retained.
test('hexToPixel is deterministic',()=>{
  const h={q:3,r:2}; assert.deepEqual(hexToPixel(h),hexToPixel(h));
});

test('six neighbors have expected center distance',()=>{
  const origin={q:0,r:0};
  for(const n of hexNeighbors(origin)){
    assert.equal(hexDistance(origin,n),1);
    const a=hexToPixel(origin), b=hexToPixel(n);
    assert.ok(near(Math.hypot(b.x-a.x,b.y-a.y),Math.sqrt(3)*HEX_SIZE));
  }
});

test('hexPolygon always has 6 vertices',()=>assert.equal(hexPolygon({q:-2,r:7}).length,6));

test('sharedHexEdge exists only for adjacent hexes',()=>{
  assert.ok(sharedHexEdge({q:0,r:0},{q:1,r:0}));
  assert.equal(sharedHexEdge({q:0,r:0},{q:2,r:0}),null);
});

test('shared edge endpoints are vertices in both polygons',()=>{
  const a={q:0,r:0}, b={q:1,r:0}, edge=sharedHexEdge(a,b); assert.ok(edge);
  for(const p of edge){assert.ok(hexPolygon(a).some(v=>pointNear(v,p))); assert.ok(hexPolygon(b).some(v=>pointNear(v,p)));}
});

test('road path consecutive hexes are adjacent',()=>{
  roadPath.slice(1).forEach((h,i)=>assert.equal(hexDistance(roadPath[i],h),1));
});

test('hexLine creates only adjacent path segments',()=>{
  const path=hexLine(offsetToAxial(2,2),offsetToAxial(8,6));
  path.slice(1).forEach((h,i)=>assert.equal(hexDistance(path[i],h),1));
});

test('Counter authoritative anchor equals hexToPixel(unit.hex)',()=>{
  for(const u of units){const p=deriveCounterPlacement(u); assert.deepEqual(p.authoritativeAnchor,hexToPixel(u.hex));}
});

test('two-unit stack keeps one shared authoritative hex anchor',()=>{
  const sameHexUnits=units.filter(u=>u.id==='G-ST1'||u.id==='G-ST2'); assert.equal(sameHexUnits.length,2);
  const p0=deriveCounterPlacement(sameHexUnits[0],0,2), p1=deriveCounterPlacement(sameHexUnits[1],1,2);
  assert.deepEqual(p0.authoritativeAnchor,p1.authoritativeAnchor); assert.notDeepEqual(p0.visualCenter,p1.visualCenter);
});

test('Reachable overlay points exactly equal base polygon points',()=>{
  for(const h of reachableHexes) assert.equal(deriveOverlayPolygon(h),polygonPointsString(h));
});

test('ZOC overlay points exactly equal base polygon points',()=>{
  for(const h of enemyZocHexes) assert.equal(deriveOverlayPolygon(h),polygonPointsString(h));
});

test('River geometry is exactly sharedHexEdge',()=>{
  for(const {a,b} of riverEdges) assert.deepEqual(deriveRiverEdge(a,b),sharedHexEdge(a,b));
});

test('Bridge crossing is midpoint of its river shared edge',()=>{
  for(const {a,b} of bridgeEdges){
    const edge=sharedHexEdge(a,b); assert.ok(edge); const g=deriveBridgeGeometry(a,b);
    assert.ok(near(g.crossing.x,(edge[0].x+edge[1].x)/2)); assert.ok(near(g.crossing.y,(edge[0].y+edge[1].y)/2));
  }
});

test('Railway path consecutive hexes are adjacent',()=>{
  railPath.slice(1).forEach((h,i)=>assert.equal(hexDistance(railPath[i],h),1));
});

test('Attack Target overlay points exactly equal base polygon points',()=>{
  for(const h of attackTargetHexes) assert.equal(deriveOverlayPolygon(h),polygonPointsString(h));
});

test('River segment sequence is continuous vertex-to-vertex',()=>{
  const same=(a,b)=>pointNear(a,b);
  for(let i=1;i<riverEdges.length;i++){
    const prev=deriveRiverEdge(riverEdges[i-1].a,riverEdges[i-1].b);
    const cur=deriveRiverEdge(riverEdges[i].a,riverEdges[i].b);
    assert.ok(prev.some(p=>cur.some(q=>same(p,q))),`river segment ${i-1} does not touch ${i}`);
  }
});

test('Each bridge edge is both a river edge and a road/rail center crossing',()=>{
  const sameHex=(a,b)=>a.q===b.q&&a.r===b.r;
  const samePair=(a,b,c,d)=>(sameHex(a,c)&&sameHex(b,d))||(sameHex(a,d)&&sameHex(b,c));
  const routeHas=(route,a,b)=>route.slice(1).some((h,i)=>samePair(route[i],h,a,b));
  for(const bridge of bridgeEdges){
    assert.ok(riverEdges.some(e=>samePair(e.a,e.b,bridge.a,bridge.b)));
    assert.ok(routeHas(roadPath,bridge.a,bridge.b)||routeHas(railPath,bridge.a,bridge.b));
  }
});

test('Single and stacked counter rectangles stay inside their owning hex',()=>{
  function insideConvex(point, polygon){
    let sign=0;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i], b=polygon[(i+1)%polygon.length];
      const cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
      if(Math.abs(cross)<1e-7) continue;
      const s=Math.sign(cross);
      if(sign===0) sign=s; else if(sign!==s) return false;
    }
    return true;
  }
  const groups=new Map();
  for(const u of units){const k=`${u.hex.q},${u.hex.r}`;groups.set(k,[...(groups.get(k)??[]),u]);}
  for(const group of groups.values()){
    group.forEach((u,index)=>{
      const p=deriveCounterPlacement(u,index,group.length), half=p.side/2;
      const corners=[
        {x:p.visualCenter.x-half,y:p.visualCenter.y-half},{x:p.visualCenter.x+half,y:p.visualCenter.y-half},
        {x:p.visualCenter.x+half,y:p.visualCenter.y+half},{x:p.visualCenter.x-half,y:p.visualCenter.y+half},
      ];
      const polygon=hexPolygon(u.hex);
      for(const c of corners) assert.ok(insideConvex(c,polygon),`${u.id} corner escaped owning hex`);
    });
  }
});

// UI-002 visual/touch regression additions.
test('Selected state keeps the same authoritative anchor',()=>{
  assert.ok(SELECTED_VISUAL_SCALE>1);
  const u=units.find(unit=>unit.id===initialSelectedUnitId);
  assert.ok(u);
  const base=deriveCounterPlacement(u).authoritativeAnchor;
  const path=makePath(initialSelectedUnitId,reachableHexes[0]);
  const selected=svgMarkup({selectedUnitId:u.id,plannedPath:path,debug:false});
  const unselected=svgMarkup({selectedUnitId:'S-T1',plannedPath:path,debug:false});
  const anchor=`data-anchor-x="${base.x}" data-anchor-y="${base.y}"`;
  assert.ok(selected.includes(anchor));
  assert.ok(unselected.includes(anchor));
});

test('OOS state does not change authoritative anchor',()=>{
  const u=units[0];
  const toggled={...u,oos:!u.oos};
  assert.deepEqual(deriveCounterPlacement(u).authoritativeAnchor,deriveCounterPlacement(toggled).authoritativeAnchor);
});

test('Damage state does not change authoritative anchor',()=>{
  const u=units[0];
  const toggled={...u,damage:2};
  assert.deepEqual(deriveCounterPlacement(u).authoritativeAnchor,deriveCounterPlacement(toggled).authoritativeAnchor);
});

test('Touch hit area is >=44 units and centered on canonical anchor',()=>{
  assert.ok(TOUCH_HIT_SIZE>=44);
  for(const u of units){
    const hit=deriveTouchHitArea(u);
    assert.deepEqual(hit.center,hexToPixel(u.hex));
    assert.ok(hit.side>=44);
  }
});

test('Attack Target derived bracket points remain inside/on owning target hex',()=>{
  function insideConvex(point, polygon){
    let sign=0;
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i], b=polygon[(i+1)%polygon.length];
      const cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);
      if(Math.abs(cross)<EPSILON) continue;
      const s=Math.sign(cross);
      if(sign===0) sign=s; else if(sign!==s) return false;
    }
    return true;
  }
  for(const h of attackTargetHexes){
    const polygon=hexPolygon(h);
    for(const point of deriveTargetBrackets(h).flat()) assert.ok(insideConvex(point,polygon));
  }
});

test('Overlay renderer preserves exact canonical polygon points',()=>{
  const markup=svgMarkup({selectedUnitId:initialSelectedUnitId,plannedPath:makePath(initialSelectedUnitId,reachableHexes[0]),debug:false});
  for(const h of [...reachableHexes,...enemyZocHexes,...attackTargetHexes]){
    assert.ok(markup.includes(`points="${polygonPointsString(h)}"`));
  }
});

test('Responsive renderer uses one canonical viewBox and preserveAspectRatio',()=>{
  const path=makePath(initialSelectedUnitId,reachableHexes[0]);
  const normal=svgMarkup({selectedUnitId:initialSelectedUnitId,plannedPath:path,debug:false});
  const debug=svgMarkup({selectedUnitId:initialSelectedUnitId,plannedPath:path,debug:true});
  const expected=`viewBox="${MAP_VIEWBOX.minX} ${MAP_VIEWBOX.minY} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}"`;
  assert.equal((normal.match(/viewBox=/g)??[]).length,1);
  assert.equal((debug.match(/viewBox=/g)??[]).length,1);
  assert.ok(normal.includes(expected));
  assert.ok(debug.includes(expected));
  assert.ok(normal.includes('preserveAspectRatio="xMidYMid meet"'));
});

test('No unit model contains authoritative x/y placement',()=>{
  for(const u of units){assert.equal('x' in u,false);assert.equal('y' in u,false);}
});

test('No tactical overlay model contains hand-authored pixel vertices',()=>{
  for(const h of [...reachableHexes,...enemyZocHexes,...attackTargetHexes]){
    assert.deepEqual(Object.keys(h).sort(),['q','r']);
  }
});

test('Counter layer renders above overlay layer and handlers stop propagation',async()=>{
  const markup=svgMarkup({selectedUnitId:initialSelectedUnitId,plannedPath:makePath(initialSelectedUnitId,reachableHexes[0]),debug:false});
  assert.ok(markup.indexOf('id="counter-layer"')>markup.indexOf('id="overlay-base-layer"'));
  const mainSource=await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  assert.match(mainSource,/stopPropagation\(\)/);
});

test('Forest vector variant selection is deterministic across renders',()=>{
  const state={selectedUnitId:initialSelectedUnitId,plannedPath:makePath(initialSelectedUnitId,reachableHexes[0]),debug:false};
  const a=svgMarkup(state);
  const b=svgMarkup(state);
  const variantsA=[...a.matchAll(/data-forest-variant="(\d+)"/g)].map(m=>m[1]);
  const variantsB=[...b.matchAll(/data-forest-variant="(\d+)"/g)].map(m=>m[1]);
  assert.deepEqual(variantsA,variantsB);
  assert.ok(new Set(variantsA).size>=2);
});

test('Debug mode includes counter bounds, touch bounds and canonical anchors',()=>{
  const markup=svgMarkup({selectedUnitId:initialSelectedUnitId,plannedPath:makePath(initialSelectedUnitId,reachableHexes[0]),debug:true});
  assert.ok(markup.includes('debug-counter-bounds'));
  assert.ok(markup.includes('debug-touch-bounds'));
  assert.ok(markup.includes('counter-anchor-debug'));
});
