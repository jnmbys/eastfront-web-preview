import {fixture,unit,G} from './combat-fixture.mjs';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {coreSvgDynamicMarkup} from '../../dist/app/render/coreSvg.js';
import {svgDom} from './svg-dom.mjs';
import {UnitAnimationRuntime} from '../../dist/app/presentation/runtime.js';

export function clock(){
 let now=0,serial=0;const frames=new Map();
 return {now:()=>now,request:cb=>{frames.set(++serial,cb);return serial;},cancel:id=>frames.delete(id),
  tick(ms){now+=ms;const pending=[...frames.values()];frames.clear();for(const cb of pending)cb(now);},pending:()=>frames.size};
}
export function movementFixture(units=[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]){
 const f=fixture(2722,units);f.s.state.phase='GERMAN_MOVEMENT';f.p.selectedUnitId='g';return f;
}
export const move=(id='g',path=[{q:1,r:0},{q:1,r:1}])=>({type:'MOVE',controllerId:G,unitId:id,path});
export function element(attrs){return {attrs:{...attrs},writes:0,getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);this.writes++;},removeAttribute(k){delete this.attrs[k];this.writes++;}};}
export function mapDom(s,p){
 const html=coreSvgDynamicMarkup(deriveBrowserRenderModel(s,p),{debug:false,rendererMode:'prototype'});
 const root=svgDom(`<svg id="eastfront-map" data-lod="medium" viewBox="-300 -250 600 500"><g id="map-dynamic-layer">${html}</g></svg>`);
 root.html=html;root.nodes=root.querySelectorAll('*');
 root.counter=id=>root.querySelector(`[data-unit-id="${id}"]`);
 root.hit=id=>root.querySelector(`[data-hit-unit-id="${id}"]`);
 return root;
}
export function harness(f=movementFixture(),speed='normal'){
 const time=clock(),runtime=new UnitAnimationRuntime(time);runtime.setSpeed(speed);let dom=mapDom(f.s,f.p);runtime.sync(f.s,dom);
 return {...f,time,runtime,dom:()=>dom,remount(){dom=mapDom(f.s,f.p);runtime.sync(f.s,dom);return dom;},finish(){time.tick(10000);}};
}
export const transform=point=>`translate(${point.x} ${point.y})`;
