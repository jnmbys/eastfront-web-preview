// Software-rasterized samples of the actual animation runtime, NOT browser screenshots.
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {harness,move} from '../../tests/helpers/animation-fixture.mjs';
import {dispatchGameAction} from '../../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {renderCounter} from '../../dist/app/render/coreSvg.js';
import {hexToPixel,polygonPointsString} from '../../dist/app/geometry/hex.js';
import {setLocale} from '../../dist/app/localization/index.js';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp':'sharp');
setLocale('en-US');const h=harness(),before=h.s.state,source={...before.units.g.hex};
const result=dispatchGameAction(h.s,move()).result;if(!result.accepted)throw Error(JSON.stringify(result.issues));h.remount();
const counter=deriveBrowserRenderModel(h.s,h.p).counters.find(c=>c.id==='g'),finalGlyph=renderCounter(counter,0,1),trace=[];
const coords=[];for(let q=-1;q<=2;q++)for(let r=-1;r<=2;r++)coords.push({q,r});
const grid=coords.map(c=>`<polygon points="${polygonPointsString(c)}" fill="#283b3d" stroke="#52605e" stroke-width=".6"/>`).join('');
const dest=hexToPixel(counter.hex),origin=hexToPixel(source),via=hexToPixel({q:1,r:0});
const route=`<polyline points="${origin.x},${origin.y} ${via.x},${via.y} ${dest.x},${dest.y}" fill="none" stroke="#d9c28a" stroke-width="1.3" stroke-dasharray="3 4"/><circle cx="${origin.x}" cy="${origin.y}" r="4" fill="#d9c28a"/><polygon points="${polygonPointsString(counter.hex)}" fill="none" stroke="#d9c28a" stroke-width="1.5"/>`;
await mkdir(new URL('./sampled/',import.meta.url),{recursive:true});
for(let i=0;i<=32;i++){
 const ms=i*16.25;if(i)h.time.tick(16.25);
 const attrs=h.dom().counter('g').attrs,state=h.runtime.coordinator.snapshot().get('g');
 const animated=finalGlyph.replace(/transform="translate\([^\"]+\)"/,`transform="${attrs.transform}"`);
 trace.push({ms,coreHex:{...h.s.state.units.g.hex},visualTransform:attrs.transform,phase:state?.phase??'idle',progress:state?.progress??1,canonicalVisualPosition:state?.currentCanonicalPosition??dest,pendingFrames:h.time.pending()});
 const scene=glyph=>`<svg x="0" y="0" width="500" height="320" viewBox="-80 -80 310 250">${grid}${route}${glyph}</svg>`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="480" viewBox="0 0 1120 480"><style>text{font-family:DejaVu Sans,sans-serif}.counter-id{font-size:5px}.counter-stats{font-size:8px;font-weight:bold}.unit-symbol path,.unit-symbol ellipse{fill:none;stroke:currentColor;stroke-width:1.8}</style><rect width="1120" height="480" fill="#101923"/><text x="34" y="37" fill="#f2e4c9" font-size="22">EASTFRONT / UA-001 MOVEMENT FOUNDATION</text><text x="34" y="65" fill="#b3c1c2" font-size="13">Actual Core MOVE + canonical geometry + Counter V2 + sampled animation coordinator</text><text x="34" y="109" fill="#f2e4c9" font-size="17">BEFORE: immediate destination</text><text x="584" y="109" fill="#f2e4c9" font-size="17">AFTER: source → path → destination</text><g transform="translate(26 118)">${scene(finalGlyph)}</g><g transform="translate(576 118)">${scene(animated)}</g><text x="34" y="451" fill="#a7b8b9" font-size="12">Software-rasterized evidence · not a browser capture · Core is already at (1,1) in both panels</text><text x="945" y="451" fill="#e7cf94" font-size="12">${Math.round(ms)} / 520 ms</text></svg>`;
 await writeFile(new URL(`./sampled/frame-${String(i).padStart(2,'0')}.svg`,import.meta.url),svg);
 await sharp(Buffer.from(svg)).png().toFile(new URL(`./sampled/frame-${String(i).padStart(2,'0')}.png`,import.meta.url).pathname);
}
await writeFile(new URL('./movement-trace.json',import.meta.url),JSON.stringify({evidenceType:'runtime samples; not browser capture',source,coreDestination:counter.hex,durationMs:520,gameplayRandomBefore:before.random,gameplayRandomAfter:h.s.state.random,frames:trace},null,2)+'\n');
