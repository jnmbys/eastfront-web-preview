// Minimal DOM adapter for executing the built application's actual event bindings.
// This verifies interaction/state transitions, not browser layout or hit testing.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as core from '../../dist/app/core-adapter/core.js';
import * as sessionApi from '../../dist/app/core-adapter/session.js';
import * as intents from '../../dist/app/interaction/intents.js';
import * as flow from '../../dist/app/interaction/combatFlow.js';
import * as locale from '../../dist/app/localization/index.js';
import {issueText} from '../../dist/app/localization/issues.js';
import * as ui from '../../dist/app/ui/commandPresentation.js';
import {createDeploymentTouch} from '../../dist/app/ui/deploymentTouch.js';
import {combatAttackPanel} from '../../dist/app/ui/combatAttackPanel.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {coreSvgDynamicMarkup} from '../../dist/app/render/coreSvg.js';
const source=readFileSync(new URL('../../dist/app/main.js',import.meta.url),'utf8');
function node(attrs={},text=''){
 const handlers={};return {attrs,style:{},dataset:Object.fromEntries(Object.entries(attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase()),v])),disabled:'disabled'in attrs,textContent:text,
 classList:{toggle(){}},setAttribute(k,v){attrs[k]=v;},addEventListener(type,fn){(handlers[type]??=[]).push(fn);},fire(type){for(const fn of handlers[type]??[])fn({currentTarget:this,stopPropagation(){},preventDefault(){}});}};
}
function parse(html){return [...html.matchAll(/<(button|polygon|g|rect)\b([^>]*)>/g)].map(([,tag,raw])=>{
 const attrs=Object.fromEntries([...raw.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,k,v])=>[k,v]));if(/\sdisabled(?:\s|$)/.test(raw))attrs.disabled='';return node(attrs);
});}
export function combatDom(s,p){
 delete s.viewOverride; // Interactive controller regression is a player, not an observer fixture.
 let mapNodes=[],panelNodes=[],painted='',mapHtml='';const frames=[];
 const scroll={scrollTop:0},svg={style:{},dataset:{lod:'medium'}},surface={style:{}},wrap={dataset:{}},readout={};
 const panel={dataset:{viewerControllerId:s.activeViewerControllerId},querySelectorAll:()=>[],querySelector:q=>q==='.command-panel-scroll'?scroll:null,set innerHTML(html){painted=html;panelNodes=parse(html);},get innerHTML(){return painted;}};
 const dynamic={set innerHTML(html){mapHtml=html;mapNodes=parse(html);}};
 const fixed={'#side-panel':panel,'#eastfront-map':svg,'#terrain-surface':surface,'#map-wrap':wrap,'#zoom-readout':readout,'#map-dynamic-layer':dynamic,'.command-panel-scroll':scroll};
 const match=(el,q)=>q.startsWith('#')?el.attrs.id===q.slice(1):/^\[/.test(q)?(()=>{const [,attr,value]=q.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/)??[];return attr in el.attrs&&(value===undefined||el.attrs[attr]===value);})():false;
 const document={querySelector:q=>fixed[q]??[...mapNodes,...panelNodes].find(el=>match(el,q))??null,querySelectorAll:q=>[...mapNodes,...panelNodes].filter(el=>q.split(',').some(part=>match(el,part.trim())))};
 const ctx=vm.createContext({DynamicMapRenderer:class {update(layer,model,options){layer.innerHTML=coreSvgDynamicMarkup(model,options);}},...core,...sessionApi,...intents,...flow,...locale,...ui,issueText,combatAttackPanel,deriveBrowserRenderModel,coreSvgDynamicMarkup,session:s,presentation:p,document,developerUi:false,deploymentTouch:createDeploymentTouch(),esc:ui.escapeUi,mapViewport:{zoom:1.8,panX:94,panY:-61},chooseCounterTarget:()=>false,paintDeploymentFocus(){},mapRenderOptions:()=>({debug:false,rendererMode:'prototype'}),requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},setTimeout:cb=>{cb();},render:()=>repaint()});
 const run=(start,end)=>vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end)),ctx);
 run('function sideLabel(','function startNewGame(');
 run('function applyMapViewport(','function bindMapViewport(');
 run('function sidePanelMarkup(','function render(');
 run('function showCombatView(','async function boot(');
 // Main's private coordinate decoder is used by map bindings.
 vm.runInContext(source.slice(source.indexOf('function parseHex('),source.indexOf('function sideLabel(')),ctx);
 function repaint(){panel.dataset.viewerControllerId=s.activeViewerControllerId;const model=deriveBrowserRenderModel(s,p);dynamic.innerHTML=coreSvgDynamicMarkup(model,{debug:false,rendererMode:'prototype'});panel.innerHTML=ctx.sidePanelMarkup(model);ctx.bindDynamic();ctx.applyMapViewport();}
 repaint();
 return {ctx,document,svg,surface,scroll,html:()=>painted,mapHtml:()=>mapHtml,repaint,click(selector){const el=document.querySelector(selector);if(!el)throw new Error(`Missing clickable ${selector}`);if(el.disabled)throw new Error(`Disabled ${selector}`);el.fire('click');return el;},async paint(){for(const fn of frames.splice(0))fn();await Promise.resolve();await Promise.resolve();},camera:()=>JSON.stringify(ctx.mapViewport)};
}
