// Scalar cost / single-hex packing study. Never generates or writes an expanded map.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),out=new URL('./',import.meta.url);
const read=async p=>JSON.parse(await readFile(new URL(p,root)));
const map=await read('evidence/ART-MAP-015/semantic-map.json');
const cost=await read('evidence/ART-MAP-015/cost.json');
const manifest=await read('evidence/ART-MAP-015/runtime-manifest.json');
const mapEntry=manifest.entries.find(e=>e.path==='map.json');
const assetBytes=manifest.entries.filter(e=>e.path.replaceAll('\\','/').startsWith('assets/')).reduce((s,e)=>s+e.bytes,0);
const points=map.cells.flatMap(h=>h.polygon),width=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))+16,height=Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))+16;
const aux=cost.sumListedCanvasBytes-cost.canvasBackingEstimates.estimatedCanvasBytes;
const baselineUnitCount=58,domBase=2457;
const scenarios=[640,800,1000].map(n=>{
 const ratio=n/640,linear=Math.sqrt(ratio),box={width:width*linear,height:height*linear};
 const scale=Math.min(2,4096/Math.max(box.width,box.height));
 const w=Math.ceil(box.width*scale),h=Math.ceil(box.height*scale),preservedW=Math.ceil(4096*linear),preservedH=Math.ceil(3689*linear);
 const units=Math.round(baselineUnitCount*ratio),deltaUnits=units-baselineUnitCount;
 const mapDelta=Math.round(mapEntry.bytes*(ratio-1));
 const mapFit=360/box.width,unitCssAt300=42*1.14*mapFit*3,zoomFor44=44/(42*1.14*mapFit);
 return {cells:n,areaRatio:ratio,linearRatio:linear,assetBytes,newAssetBytesAssumingReuse:0,
 package:{baselineBytes:cost.runtimeBytes,mapJsonBaselineBytes:mapEntry.bytes,estimatedMapDeltaBytes:mapDelta,estimatedTotalBytes:cost.runtimeBytes+mapDelta,note:'Uncompressed map JSON scales with cells/features at unchanged schema and feature density; all other runtime files fixed. Not a generated build.'},
 canvas:{box,scale,rasterWidth:w,rasterHeight:h,mainBytes:w*h*4,listedAuxBytes:aux,listedTotalBytes:w*h*4+aux,perHexLinearResolutionVs640:1/linear,perHexPixelAreaVs640:1/ratio,preserve640Resolution:{width:preservedW,height:preservedH,mainBytes:preservedW*preservedH*4,listedTotalBytes:preservedW*preservedH*4+aux}},
 dom:{fixed58:domBase+2*(n-640),sameDensity:{units,estimatedLow:domBase+2*(n-640)+20*deltaUnits,estimatedHigh:domBase+2*(n-640)+32*deltaUnits},industrialIncrement:'3F for existing inert placeholder groups; 0 for canvas-only stamps; actual interactive facility UI unknown'},
 density:{fixedUnits:58,per100Cells:5800/n,sameDensityUnits:units,sameDensityPer100Cells:units*100/n},
 industrial:{illustrativeClusters:8,minimumTwoCellReservations:16,threeCellReservations:24,sharePercent:[1600/n,2400/n],note:'8 clusters is a comparison assumption, not a requested factory count; reservation cells are design-space bookkeeping, not new terrain/rules.'},
 mobile:{availableMapArea:[360,600],unitVisualCssAt300:unitCssAt300,zoomFor44CssUnit:zoomFor44,zoomLimitInViewer:8,note:'Illustrative CSS projection only; 44px is an operation-budget assumption, not measured touch acceptance.'},
 fullScanWorkRatios:{fixedDensityEdges:ratio*ratio,fixedUnits:ratio,scaledUnits:ratio*units/58},
 strategicInterpretations:{fixedHexDistance:{areaRatio:ratio,typicalLinearExtentRatio:linear},fixedWorldExtent:{hexDistanceRatio:1/linear,hexAreaRatio:1/ratio,note:'Would require rules/time/movement/industrial scale decisions; art does not select these.'}}
 };
});
// Same pointy-top hex geometry as HEX_SIZE=42. Sample centers on a 0.5 world-unit lattice.
const poly=Array.from({length:6},(_,i)=>{const a=(60*i+30)*Math.PI/180;return {x:42*Math.cos(a),y:42*Math.sin(a)};});
function inside(p){let yes=false;for(let i=0,j=5;i<6;j=i++){const a=poly[i],b=poly[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
function pack(w,h,{unit=false,rail=false}={}){let count=0,example=null;for(let y=-42;y<=42;y+=.5)for(let x=-42;x<=42;x+=.5){if(![-1,1].every(a=>[-1,1].every(b=>inside({x:x+a*w/2,y:y+b*h/2}))))continue;if(Math.abs(x)<10+w/2&&Math.abs(y-29)<5+h/2)continue;if(unit&&Math.abs(x)<34+w/2&&Math.abs(y)<34+h/2)continue;if(rail&&Math.abs(y)<7+h/2)continue;count++;example??={x,y};}return {count,example};}
const packing={hex:{size:42,width:Math.sqrt(3)*42,height:84,area:3*Math.sqrt(3)/2*42**2},unitClearance:[68,68],labelClearance:[20,10],railHalfExclusion:7,
 placeholderOnly:{footprint:[38,20],emptyCell:pack(38,20),centerRail:pack(38,20,{rail:true}),unitCell:pack(38,20,{unit:true})},
 withProvisionalTwoUnitPadding:{footprint:[42,24],emptyCell:pack(42,24),centerRail:pack(42,24,{rail:true}),unitCell:pack(42,24,{unit:true})},
 method:'Geometric packing only, axis-aligned rectangle, horizontal center rail and label at (0,29). 0.5-unit sample grid is not a guarantee for all orientations/bridge/river situations; occupied-cell impossibility also follows from bounding rectangles.'};
assert.equal(map.cells.length,640);assert.equal(scenarios[0].canvas.mainBytes,60440576);assert.equal(scenarios[0].canvas.listedTotalBytes,67933116);assert.equal(scenarios[0].dom.fixed58,2457);assert.equal(scenarios[0].package.estimatedTotalBytes,3996913);
assert(packing.placeholderOnly.centerRail.count>0);assert.equal(packing.placeholderOnly.unitCell.count,0);assert.equal(packing.withProvisionalTwoUnitPadding.centerRail.count,0);
const raw=await readFile(new URL('candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',root));
assert.equal(createHash('sha256').update(raw).digest('hex'),'150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3');
const inputs={baseline:'754da7cdfb7a343f51d7a008cec921c4dbd9d0fa',formalMapSHA256:createHash('sha256').update(raw).digest('hex'),formalCells:640,formalEdges:map.edges.length,formalFixtureUnits:map.fixtures.length,baselinePackage:cost.runtimeBytes,assetBytes,assumptions:['Same effective bounding-box aspect ratio; scalar extent estimate, no expanded map objects.','Same HEX_SIZE=42, five atlases, terrain/connection density, renderer and 015 local reference caches.','58 display fixtures are not the future game roster.','Industrial images, industrial rules, real map placement and UI not decided.'],limits:['All B/C costs are projections, not runtime measurements.','Canvas totals exclude decoded images, transient ImageData, browser copies, GPU/RSS and GC.','No startup, GPU, Huawei or touch measurement. Historical 708ms remains open.']};
await mkdir(out,{recursive:true});await writeFile(new URL('estimates.json',out),JSON.stringify({inputs,scenarios,packing},null,2)+'\n');
console.log(JSON.stringify({status:'PASS',checks:'640 baseline anchors + packing invariants',assetBytes,mapJsonBytes:mapEntry.bytes,scenarios:scenarios.map(s=>({cells:s.cells,bytes:s.package.estimatedTotalBytes,cappedCanvas:s.canvas.listedTotalBytes,preservedCanvas:s.canvas.preserve640Resolution.listedTotalBytes,dom:s.dom,units:s.density,zoom44:s.mobile.zoomFor44CssUnit})),packing},null,2));
