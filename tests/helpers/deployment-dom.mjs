// Production main handlers in a counted software DOM. No layout/paint/GPU emulation.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {SvgNode,svgDom} from './performance-dom.mjs';

const plainMatch=SvgNode.prototype.matches;
SvgNode.prototype.matches=function(selector){
 return (selector.match(/(?:\[[^\]]*\]|[^,])+/g)??[]).some(part=>{
  const tokens=part.trim().split(/\s+/),last=tokens.pop();
  if(!last)return false;
  const tag=last.match(/^[\w-]+/)?.[0],rest=tag?last.slice(tag.length):last;
  if(tag&&this.tagName!==tag)return false;
  if(rest&&!plainMatch.call(this,rest))return false;
  if(!tag&&!rest)return false;
  let parent=this.parentNode;
  while(tokens.length){const token=tokens.pop();while(parent&&!parent.matches(token))parent=parent.parentNode;if(!parent)return false;parent=parent.parentNode;}
  return true;
 });
};
Object.defineProperties(SvgNode.prototype,{
 dataset:{get(){return new Proxy({}, {get:(_t,k)=>this.getAttribute('data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_t,k,v)=>{this.setAttribute('data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),v);return true;},deleteProperty:(_t,k)=>{this.removeAttribute('data-'+String(k).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));return true;}});}},
 classList:{get(){return {toggle:(c,force)=>{const a=new Set((this.getAttribute('class')??'').split(/\s+/));const on=force??!a.has(c);if(on)a.add(c);else a.delete(c);this.setAttribute('class',[...a].filter(Boolean).join(' '));return on;}};}},
 disabled:{get(){return this.getAttribute('disabled')!==null;},set(v){if(v)this.setAttribute('disabled','');else this.removeAttribute('disabled');}},
 parentElement:{get(){return this.parentNode;}},
 nextSibling:{get(){return this.parentNode?.children[this.parentNode.children.indexOf(this)+1]??null;}},
 nextElementSibling:{get(){return this.nextSibling;}},
 style:{get(){return this._style??={};}},
 isConnected:{get(){let n=this;while(n.parentNode)n=n.parentNode;return Boolean(n._connected);}}
});
SvgNode.prototype.addEventListener=function(type,fn){this._listeners??={};(this._listeners[type]??=[]).push(fn);};
SvgNode.prototype.removeEventListener=function(type,fn){if(this._listeners?.[type])this._listeners[type]=this._listeners[type].filter(f=>f!==fn);};
SvgNode.prototype.fire=function(type){if(type==='click'&&this.disabled)return;for(const fn of this._listeners?.[type]??[])fn({currentTarget:this,target:this,stopPropagation(){},preventDefault(){}});};
SvgNode.prototype.replaceWith=function(node){this.parentNode?.insertBefore(node,this);this.remove();};
SvgNode.prototype.contains=function(node){for(let p=node;p;p=p.parentNode)if(p===this)return true;return false;};
SvgNode.prototype.insertAdjacentHTML=function(_where,html){const fragment=this.ownerDocument.createElement('div');fragment.innerHTML=html;for(const node of [...fragment.children])this.appendChild(node);};

export async function deploymentDom(session,presentation,{dist='dist/app',measure=(name,fn)=>fn()}={}){
 const load=p=>import(pathToFileURL(resolve(dist,p)).href);
 const [core,sessionApi,playerSession,locale,ui,touch,polish,combat,svgApi,mapApi,animApi,fogApi]=await Promise.all([
  'core-adapter/core.js','core-adapter/session.js','multiplayer/playerSession.js','localization/index.js','ui/commandPresentation.js','ui/deploymentTouch.js','ui/deploymentPolish.js','ui/combatAttackPanel.js','render/coreSvg.js','render/dynamicMap.js','presentation/runtime.js','fog/runtime.js'
 ].map(load));
 const {issueText}=await load('localization/issues.js');
 const options={debug:false,rendererMode:'production',staticTerrainSurface:true,lod:'medium'};
 const initial=playerSession.deriveBrowserRenderModel(session,presentation);
 const root=svgDom(`<header class="command-hud"></header><p id="network-match-status"></p><div id="map-wrap" data-zoom="1.8">${svgApi.coreSvgMarkup(initial,options)}</div><aside id="side-panel"></aside>`);root._connected=true;
 const document=root.ownerDocument;
 document.createElement=tag=>document.createElementNS('',tag);
 document.querySelector=q=>root.querySelector(q);document.querySelectorAll=q=>root.querySelectorAll(q);
 const frames=new Map();let serial=0;
 const animations=new animApi.UnitAnimationRuntime({now:()=>performance.now(),request:f=>{frames.set(++serial,f);return serial;},cancel:id=>frames.delete(id)});
 const fog=new fogApi.FogRuntime(r=>`software:${r.width}:${r.height}`);
 const source=readFileSync(resolve(dist,'main.js'),'utf8');
 const ctx=vm.createContext({...core,...sessionApi,...playerSession,...locale,...ui,...touch,...polish,...combat,...svgApi,issueText,
  DynamicMapRenderer:class extends mapApi.DynamicMapRenderer {update(...args){return measure('dynamicMapUpdate',()=>super.update(...args));}},session,presentation,document,performance,developerUi:false,
  deploymentTouch:touch.createDeploymentTouch(),esc:ui.escapeUi,mapViewport:{zoom:1.8,panX:94,panY:-61},
  unitAnimations:animations,fogSurface:fog,mapRenderOptions:()=>options,applyMapViewport(){},
  requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},setTimeout,clearTimeout,render:()=>{if(presentation.privacyGate){root.innerHTML='';return;}ctx.refreshDynamicView();}
 });
 // Optional presentation module added by PERF-002; baseline has no such import.
 if(source.includes('DeploymentPanelRenderer'))Object.assign(ctx,await load('ui/deploymentPanelRenderer.js'));
 const run=(a,b)=>vm.runInContext(source.slice(source.indexOf(a),source.indexOf(b)),ctx);
 run('function syncFogSurface(','function parseHex(');
 run('function parseHex(','function startNewGame(');
 run('function sidePanelMarkup(','function render(');
 run('function showCombatView(','async function enterNetworkMatch(');
 for(const name of ['refreshDynamicView','sidePanelMarkup','deploymentPanel','paintDeploymentFocus','bindDynamic','updateNetworkStatus']){
  const fn=ctx[name];ctx[name]=(...args)=>measure(name,()=>fn(...args));
 }
 const panel=document.querySelector('#side-panel');panel.dataset.viewerControllerId=session.activeViewerControllerId;
 const html=Object.getOwnPropertyDescriptor(SvgNode.prototype,'innerHTML');
 Object.defineProperty(panel,'innerHTML',{get(){return html.get.call(this);},set(value){measure('panelDomReplace',()=>html.set.call(this,value));}});
 ctx.refreshDynamicView();
 const unitNodes=()=>root.querySelectorAll('[data-unit-id]');
 return {ctx,root,document,animations,fog,frames,unitNodes,
  render:()=>ctx.refreshDynamicView(),
  click(q){const node=document.querySelector(q);if(!node)throw Error('Missing '+q);if(node.disabled)throw Error('Disabled '+q);node.fire('click');},
  select(id,key){ctx.deploymentTouch=touch.createDeploymentTouch();presentation.selectedDeploymentUnitId=id;touch.chooseDeploymentTarget(ctx.deploymentTouch,playerSession.deriveBrowserRenderModel(session,presentation),id,key);ctx.refreshDynamicView();},
  change(kind){if(kind==='resync'){animations.skip();ctx.deploymentTouch=touch.createDeploymentTouch();if(source.includes('DeploymentPanelRenderer'))vm.runInContext('deploymentPanelRenderer.clear()',ctx);}if(kind==='status')ctx.updateNetworkStatus();else {if(kind==='view')ctx.deploymentTouch=touch.createDeploymentTouch();ctx.refreshDynamicView();}},
  dispose(){animations.dispose();fog.clear();},
 };
}
