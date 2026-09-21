import {compactUnitPlate} from './compactUnitPlate.js';
import { contactMarkers } from './contactMarkers.js';
import { t, enumLabel } from '../localization/index.js';
import { coreHexKey, type HexCoord, type HexEdge, type TerrainType, type UnitState } from '../core-adapter/core.js';
import { HEX_SIZE, hexPolygon, hexToPixel, pointString, polygonPointsString, sharedHexEdge, type Point } from '../geometry/hex.js';
import { deriveBridgeGeometry, deriveCounterBounds, deriveCounterPlacement, deriveTouchHitArea, SELECTED_VISUAL_SCALE } from './derive.js';
import type { BrowserRenderModel, CounterModel } from './coreModel.js';
import { renderProductionBase } from './productionTerrain.js';
import type { RendererMode, TerrainAssetSet, TerrainLod } from './terrainAssets.js';

export interface CoreSvgOptions { debug:boolean; rendererMode?:RendererMode; assetSet?:TerrainAssetSet; lod?:TerrainLod; scenarioSeed?:number; marshContinuity?:boolean; staticTerrainSurface?:boolean; }
export interface ViewBoxSpec { minX:number; minY:number; width:number; height:number; }

function esc(value:string):string{return value.replace(/[&<>\"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]??char));}
function line(a:Point,b:Point,className:string,extra=''):string{return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${className}" ${extra}/>`;}

export function viewBoxForHexes(hexes:readonly {coord:HexCoord}[], margin=HEX_SIZE*0.8):ViewBoxSpec {
  const points=hexes.flatMap((hex)=>hexPolygon(hex.coord));
  if(points.length===0)return {minX:0,minY:0,width:1,height:1};
  const xs=points.map((p)=>p.x), ys=points.map((p)=>p.y);
  const minX=Math.min(...xs)-margin, maxX=Math.max(...xs)+margin;
  const minY=Math.min(...ys)-margin, maxY=Math.max(...ys)+margin;
  return {minX,minY,width:maxX-minX,height:maxY-minY};
}

function stableVariant(hex:HexCoord,count:number):number{
  const seed=Math.abs((hex.q*37)+(hex.r*61)+((hex.q+hex.r)*17));
  return seed%count;
}
function tree(x:number,y:number,scale=1):string{return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 -8 L-5 1 H-2.8 L-6 7 H6 L2.8 1 H5 Z"/><path d="M0 7 V11" class="tree-trunk"/></g>`;}
function terrainClass(terrain:TerrainType):string{return `terrain terrain-${terrain.toLowerCase().replace('_','-')}`;}
function terrainDetail(hex:HexCoord,terrain:TerrainType):string{
  const c=hexToPixel(hex);
  if(terrain==='FOREST'){
    const variants=[
      `${tree(-12,2,.82)}${tree(2,-6,1)}${tree(13,7,.7)}`,
      `${tree(-13,-6,.68)}${tree(-2,8,.9)}${tree(12,-3,.9)}${tree(16,9,.55)}`,
      `${tree(-14,7,.62)}${tree(-4,-5,.92)}${tree(9,-7,.68)}${tree(14,7,.86)}`,
      `${tree(-12,-1,.92)}${tree(1,6,.68)}${tree(11,-7,.82)}`,
    ];
    const variant=stableVariant(hex,variants.length);
    return `<g class="terrain-detail forest-detail" data-forest-variant="${variant}" transform="translate(${c.x} ${c.y})">${variants[variant]}</g>`;
  }
  if(terrain==='CITY'||terrain==='MAIN_CITY'||terrain==='OUTER_CITY'){
    const major=terrain==='MAIN_CITY';
    return `<g class="terrain-detail city-detail ${major?'capital-detail':''}" transform="translate(${c.x} ${c.y})"><rect x="-13" y="-7" width="8" height="15"/><rect x="-2" y="-12" width="9" height="20"/><rect x="10" y="-3" width="6" height="12"/>${major?'<rect x="-8" y="10" width="19" height="4"/>':''}<path d="M-18 14 H18"/></g>`;
  }
  if(terrain==='MARSH')return `<g class="terrain-detail marsh-detail" transform="translate(${c.x} ${c.y})"><path d="M-17 -8 H-3 M3 -8 H15 M-13 0 H7 M11 0 H18 M-17 8 H-5 M1 8 H13"/><path d="M-9 7 Q-6 1 -3 7 M5 6 Q8 0 11 6"/></g>`;
  if(terrain==='HILL'||terrain==='ROUGH')return `<g class="terrain-detail hill-detail ${terrain==='ROUGH'?'rough-detail':''}" transform="translate(${c.x} ${c.y})"><path d="M-19 12 Q-12 -7 -2 4 Q7 -15 19 12"/><path d="M-12 13 Q-5 2 2 9"/>${terrain==='ROUGH'?'<path d="M-15 -8 l5 -5 4 6 5 -7 6 8 5 -4"/>':''}</g>`;
  if(terrain==='LAKE')return `<g class="terrain-detail lake-detail" transform="translate(${c.x} ${c.y})"><path d="M-19 -4 Q-11 -9 -3 -4 T13 -4 M-15 5 Q-7 0 1 5 T17 5"/></g>`;
  return '';
}

function renderTerrain(model:BrowserRenderModel):string{
  return model.hexes.map((hex)=>`<g data-hex="${coreHexKey(hex.coord)}"><polygon points="${polygonPointsString(hex.coord)}" class="${terrainClass(hex.terrain)}"/>${terrainDetail(hex.coord,hex.terrain)}</g>`).join('');
}

function railSleepers(edge:HexEdge):string{
  const a=hexToPixel(edge.a), b=hexToPixel(edge.b); const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy); const nx=-dy/len,ny=dx/len;
  return [0.18,0.38,0.58,0.78].map((t)=>{const x=a.x+dx*t,y=a.y+dy*t,half=4.6;return line({x:x-nx*half,y:y-ny*half},{x:x+nx*half,y:y+ny*half},'rail-sleeper');}).join('');
}
function renderBridge(edge:HexEdge):string{
  const g=deriveBridgeGeometry(edge.a,edge.b); const dx=g.to.x-g.from.x,dy=g.to.y-g.from.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,offset=3.8;
  const a1={x:g.from.x+nx*offset,y:g.from.y+ny*offset},a2={x:g.to.x+nx*offset,y:g.to.y+ny*offset};
  const b1={x:g.from.x-nx*offset,y:g.from.y-ny*offset},b2={x:g.to.x-nx*offset,y:g.to.y-ny*offset};
  return `<g class="bridge" data-edge-key="${esc(edge.key)}">${line(g.from,g.to,'bridge-shadow')}${line(g.from,g.to,'bridge-deck')}${line(a1,a2,'bridge-rail')}${line(b1,b2,'bridge-rail')}</g>`;
}
function renderInfrastructure(model:BrowserRenderModel):string{
  const edges=model.edges;
  const roads=edges.filter((edge)=>edge.road).map((edge)=>{const a=hexToPixel(edge.a),b=hexToPixel(edge.b);return `${line(a,b,'road-underlay',`data-edge-key="${esc(edge.key)}"`)}${line(a,b,'road-center')}`;}).join('');
  const rails=edges.filter((edge)=>edge.railway?.present).map((edge)=>{const a=hexToPixel(edge.a),b=hexToPixel(edge.b);return `${line(a,b,'rail-underlay',`data-edge-key="${esc(edge.key)}"`)}${line(a,b,'rail-base')}${railSleepers(edge)}`;}).join('');
  const rivers=edges.filter((edge)=>edge.river).map((edge)=>{const shared=sharedHexEdge(edge.a,edge.b);if(!shared)throw new Error(`Core river edge ${edge.key} is not adjacent in UI geometry.`);return `${line(shared[0],shared[1],'river-bank',`data-edge-key="${esc(edge.key)}"`)}${line(shared[0],shared[1],edge.river==='MAJOR'?'river-water river-major':'river-water')}`;}).join('');
  const bridges=edges.filter((edge)=>edge.bridge&&!edge.bridge.destroyed).map(renderBridge).join('');
  return `<g id="infrastructure-layer">${roads}${rails}${rivers}${bridges}</g>`;
}

function renderDeploymentZone(model:BrowserRenderModel):string{
  if(!model.deployment)return '';
  return `<g id="deployment-zone-layer">${model.deployment.zoneKeys.map((key)=>{const hex=model.hexes.find((candidate)=>coreHexKey(candidate.coord)===key);if(!hex)return '';return `<polygon data-role="deployment-hex" data-hex="${key}" points="${polygonPointsString(hex.coord)}" class="deployment-zone" role="button" tabindex="0" aria-label="${t('map.deploymentHex',{hex:key})}"/>`;}).join('')}</g>`;
}
function renderMoveOptions(model:BrowserRenderModel):string{
  if(model.moveOptions.length===0)return '';
  return `<g id="movement-preview-layer">${model.moveOptions.map((option)=>`<polygon data-role="move-option" data-hex="${coreHexKey(option.hex)}" data-legal="${option.legal}" points="${polygonPointsString(option.hex)}" class="move-option ${option.legal?'move-legal':'move-illegal'}" role="button" tabindex="0" aria-label="${t(option.legal?'map.legalMove':'map.illegalMove',{hex:coreHexKey(option.hex)})}"/>`).join('')}</g>`;
}

function renderMovementPath(model:BrowserRenderModel):string{
  if(!model.movement||!model.selectedCounter||model.movement.path.length===0)return '';
  const hexes=[model.selectedCounter.hex,...model.movement.path];
  const points=hexes.map((hex)=>hexToPixel(hex));
  return `<g id="movement-path-layer"><polyline class="planned-path movement-draft" points="${points.map(pointString).join(' ')}"/>${points.map((p,index)=>`<circle cx="${p.x}" cy="${p.y}" r="${index===points.length-1?4.4:3}" class="path-node ${index===points.length-1?'destination-node':''}"/>`).join('')}<polygon points="${polygonPointsString(hexes.at(-1)!)}" class="destination-hex"/></g>`;
}

function renderRailInteraction(model:BrowserRenderModel):string{
  if(!model.railRepair)return '';
  const selected=new Set(model.railRepair.selectedEdgeKeys),active=new Set(model.railRepair.activeEdgeKeys);
  return `<g id="rail-interaction-layer">${model.edges.filter((edge)=>edge.railway?.present).map((edge)=>{const a=hexToPixel(edge.a),b=hexToPixel(edge.b);return `${line(a,b,`rail-repair-highlight ${active.has(edge.key)?'rail-active':''} ${selected.has(edge.key)?'rail-selected':''}`,`data-edge-key="${esc(edge.key)}"`)}${line(a,b,'rail-hit-corridor',`data-role="rail-repair-edge" data-edge-key="${esc(edge.key)}" role="button" tabindex="0" aria-label="${t('map.railEdge',{edge:esc(edge.key)})}"`)}`;}).join('')}</g>`;
}

function renderReinforcementEntries(model:BrowserRenderModel):string{
  if(!model.reinforcement)return '';
  const keys=new Set(model.reinforcement.legalEntryKeys);
  return `<g id="reinforcement-entry-layer">${model.hexes.filter((hex)=>keys.has(coreHexKey(hex.coord))).map((hex)=>`<polygon data-role="reinforcement-entry" data-hex="${coreHexKey(hex.coord)}" points="${polygonPointsString(hex.coord)}" class="reinforcement-entry" role="button" tabindex="0"/>`).join('')}</g>`;
}

function renderRecoveryBases(model:BrowserRenderModel):string{
  if(!model.recovery)return '';const keys=new Set(model.recovery.baseKeys);
  return `<g id="recovery-base-layer">${model.hexes.filter((hex)=>keys.has(coreHexKey(hex.coord))).map((hex)=>`<polygon points="${polygonPointsString(hex.coord)}" class="recovery-base" data-recovery-base="${coreHexKey(hex.coord)}"/>`).join('')}</g>`;
}

function unitSymbol(type:UnitState['type']):string{
  if(type==='INFANTRY'||type==='JAGER'||type==='ELITE_INFANTRY')return `<path d="M-10 -9 L10 9 M10 -9 L-10 9"/>${type==='JAGER'?'<text x="0" y="4" text-anchor="middle" class="unit-mini-label">J</text>':type==='ELITE_INFANTRY'?'<text x="0" y="4" text-anchor="middle" class="unit-mini-label">E</text>':''}`;
  if(type==='PANZER'||type==='TANK'||type==='HEAVY_TANK')return `<ellipse cx="0" cy="0" rx="11" ry="6.5"/>${type==='HEAVY_TANK'?'<text x="0" y="3" text-anchor="middle" class="unit-mini-label">H</text>':''}`;
  if(type==='MOTORIZED')return `<ellipse cx="0" cy="0" rx="12" ry="7"/><path d="M-9 -7 L9 7 M9 -7 L-9 7"/>`;
  if(type==='ARTILLERY')return `<circle cx="0" cy="0" r="5.5" fill="currentColor"/><path d="M-13 0 H13"/>`;
  if(type==='ENGINEER')return `<path d="M-11 7V-5H11V7M-11 1H11M-5 -5V7M5 -5V7"/>`;
  if(type==='RECON')return `<path d="M0 -9 L10 0 L0 9 L-10 0 Z"/>`;
  if(type==='ANTI_TANK')return `<path d="M0 -10L12 8H-12ZM-7 3H7"/>`;
  return `<text x="0" y="4" text-anchor="middle" class="unit-letter-label">HQ</text>`;
}
export function renderCounter(counter:CounterModel,stackIndex:number,stackSize:number):string{
  const p=deriveCounterPlacement(counter,stackIndex,stackSize),side=p.side,half=side/2,scale=counter.selected?SELECTED_VISUAL_SCALE:1;
  const faction=counter.side==='GERMAN'?'german':'soviet',face=faction==='german'?'#344c60':'#62413d',edge=faction==='german'?'#96b1c4':'#c09a83';
  const damage=counter.step===1?'/':counter.step===2?'//':'';
  const status=counter.step===0?t('counter.fullStrength'):t('counter.damage',{step:counter.step});
  const groupLabel=counter.combatRole?t(counter.combatRole==='primary'?'combat.group.primary':counter.combatRole==='selected'?'combat.group.selected':'combat.group.eligible'):'';
  const label=t('counter.label',{side:enumLabel(counter.side),type:enumLabel(counter.type),id:counter.id,status,...counter.stats,supply:enumLabel(counter.supplyState),count:stackSize,entrenched:counter.entrenched?t('counter.entrenchedSuffix'):''})+(groupLabel?` · ${groupLabel}`:'');
  const symbolScale=stackSize>1?.72:.9;
  return `<g data-unit-id="${esc(counter.id)}" data-hex="${coreHexKey(counter.hex)}" data-anchor-x="${p.authoritativeAnchor.x}" data-anchor-y="${p.authoritativeAnchor.y}" data-damage="${counter.step}" class="counter-visual counter counter-v2 ${faction} ${counter.selected?'selected':''} ${counter.combatRole?`combat-attacker-${counter.combatRole}`:''}" transform="translate(${p.visualCenter.x} ${p.visualCenter.y})" role="button" tabindex="0" aria-label="${esc(label)}" aria-pressed="${counter.selected||counter.combatRole==='selected'}"><title>${esc(label)}</title><g class="counter-face" transform="scale(${scale})">
  <rect class="counter-body" x="${-half}" y="${-half}" width="${side}" height="${side}" rx="3" fill="${face}" stroke="${counter.selected?'#f6d797':edge}" stroke-width="${counter.selected?2.5:1.3}"/>
  <rect class="counter-inset" x="${-half+2.5}" y="${-half+2.5}" width="${side-5}" height="${side-5}" rx="1.5" fill="none" stroke="${edge}" stroke-opacity=".32" stroke-width=".6"/>
  <path d="M${-half+3} ${-half+10}H${half-3}" stroke="${edge}" stroke-opacity=".45"/>
  <text class="counter-country" x="${-half+4}" y="${-half+7}" fill="#f4e8d5" font-size="5.3" font-weight="800">${counter.side==='GERMAN'?'DE':'SU'}</text>
  <text class="counter-id" x="${half-4}" y="${-half+7}" text-anchor="end" textLength="${Math.min(side-19,counter.id.replace(/^(G|S)-/,'').length*2.8)}" lengthAdjust="spacingAndGlyphs" fill="#dfded6">${esc(counter.id.replace(/^(G|S)-/,''))}</text>
  <g class="unit-symbol" color="#f1e8d5" transform="translate(0 -2) scale(${symbolScale})">${unitSymbol(counter.type)}</g>
  <path d="M${-half+3} ${half-12}H${half-3}V${half-3}H${-half+3}Z" fill="#0b151f" fill-opacity=".7"/>
  <text x="0" y="${half-5}" text-anchor="middle" class="counter-stats" fill="#f5ead7">${counter.stats.attack}-${counter.stats.defense}-${counter.stats.movement}</text>
  ${damage?`<path class="counter-damage-edge" d="M${-half+1} ${-half+12}V${half-13}" fill="none" stroke="#edc193" stroke-width="2.5" stroke-dasharray="3 2"/><text class="damage-mark" x="${-half+3}" y="${half-14}">${damage}</text>`:''}
  ${counter.supplyState==='OUT_OF_SUPPLY'?`<g class="oos-icon" transform="translate(${half-5} 0)"><title>${t('status.outOfSupply')}</title><path d="M-3 -4L3 2M-3 2L3 -4"/><circle cy="-1" r="5"/></g>`:''}
  ${counter.entrenched?`<path class="entrench-icon" d="M${-half+3} -10v4h7V-10"/>`:''}
  ${stackSize>1&&stackIndex===stackSize-1?`<g class="stack-badge" transform="translate(${half-3} ${half-2})"><title>${t('counter.stack',{count:stackSize})}</title><circle r="6"/><text y="2.3" text-anchor="middle">${stackSize}</text></g>`:''}
  </g>${compactUnitPlate(counter,stackIndex,stackSize)}</g>`;
}

function renderCombatGeometry(model:BrowserRenderModel):string{
  const combat=model.combat;if(!combat)return '';
  let out='<g id="combat-geometry-layer">';
  if(!combat.pending){
    const selected=new Set(combat.attackDraft.attackerUnitIds);
    for(const hex of combat.attackDraft.targetHexes)out+=`<polygon data-role="attack-target" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="combat-target-option ${combat.attackDraft.target&&coreHexKey(combat.attackDraft.target)===coreHexKey(hex)?'selected':''}" role="button" aria-label="${t('combat.flow.targetHex',{hex:coreHexKey(hex)})}" tabindex="0"/>`;
    if(combat.attackDraft.target){const target=hexToPixel(combat.attackDraft.target);for(const id of selected){const c=model.counters.find((u)=>u.id===id);if(c)out+=line(hexToPixel(c.hex),target,'combat-attack-line');}}
  }
  if(combat.retreat){
    for(const hex of combat.retreat.options)out+=`<polygon data-role="retreat-option" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="retreat-option" role="button" aria-label="${t('combat.flow.retreatHex',{hex:coreHexKey(hex)})}" tabindex="0"/>`;
    for(const [id,path] of Object.entries(combat.retreat.drafts)){const c=model.counters.find((u)=>u.id===id);if(!c||path.length===0)continue;const pts=[c.hex,...path].map(hexToPixel);out+=`<polyline class="retreat-draft-line" points="${pts.map(pointString).join(' ')}"/>`;}
  }
  if(combat.advance&&combat.advance.unitIds.length){const hex=combat.advance.target;out+=`<polygon data-role="advance-option" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="retreat-option advance-option" role="button" aria-label="${t('combat.flow.advanceHex',{hex:coreHexKey(hex)})}" tabindex="0"/>`;}
  if(combat.breakthrough){
    for(const option of combat.breakthrough.options)out+=`<polygon data-role="breakthrough-option" data-hex="${coreHexKey(option.hex)}" data-legal="${option.legal}" points="${polygonPointsString(option.hex)}" class="breakthrough-option ${option.legal?'legal':'illegal'}" role="button" tabindex="0"/>`;
    const tx=combat.battle;if(tx&&combat.breakthrough.path.length){const pts=[tx.targetHex,...combat.breakthrough.path].map(hexToPixel);out+=`<polyline class="breakthrough-draft-line" points="${pts.map(pointString).join(' ')}"/>`;}
  }
  if(combat.schwerpunkt){for(const hex of combat.schwerpunkt.targetOptions)out+=`<polygon data-role="schwerpunkt-target" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="schwerpunkt-target ${combat.schwerpunkt.target&&coreHexKey(combat.schwerpunkt.target)===coreHexKey(hex)?'selected':''}" role="button" tabindex="0"/>`;}
  if(combat.battle&&combat.battle.stage!=='CLOSED'){out+=`<polygon points="${polygonPointsString(combat.battle.targetHex)}" class="combat-battle-target" data-battle-id="${esc(combat.battle.battleId)}"/>`;}
  return out+'</g>';
}

function renderCounters(model:BrowserRenderModel):string{
  const groups=new Map<string,CounterModel[]>();
  for(const counter of model.counters){const key=coreHexKey(counter.hex);const list=groups.get(key)??[];list.push(counter);groups.set(key,list);}
  const hits=[...groups.values()].flatMap((group)=>group.map((counter)=>{const hit=deriveTouchHitArea(counter);return `<rect data-hit-unit-id="${esc(counter.id)}" x="${hit.center.x-hit.side/2}" y="${hit.center.y-hit.side/2}" width="${hit.side}" height="${hit.side}" class="unit-hit-area"/>`;})).join('');
  const visuals=[...groups.values()].flatMap((group)=>group.sort((a,b)=>a.id.localeCompare(b.id)).map((counter,index)=>renderCounter(counter,index,group.length))).join('');
  return `<g id="counter-hit-layer">${hits}</g><g id="counter-layer">${visuals}</g>`;
}

function renderDebug(model:BrowserRenderModel):string{
  const hexes=model.hexes.map((hex)=>{const c=hexToPixel(hex.coord);return `<g><polygon points="${polygonPointsString(hex.coord)}" class="debug-boundary"/><circle cx="${c.x}" cy="${c.y}" r="2.2" class="debug-center"/><text x="${c.x}" y="${c.y+9}" text-anchor="middle" class="debug-label">${hex.coord.q},${hex.coord.r}</text></g>`;}).join('');
  const edges=model.edges.map((edge)=>{const a=hexToPixel(edge.a),b=hexToPixel(edge.b);let out='';if(edge.road)out+=`<circle cx="${a.x}" cy="${a.y}" r="2.7" class="debug-road-node"/><circle cx="${b.x}" cy="${b.y}" r="2.7" class="debug-road-node"/>`;if(edge.railway?.present)out+=`<circle cx="${a.x}" cy="${a.y}" r="2" class="debug-rail-node"/><circle cx="${b.x}" cy="${b.y}" r="2" class="debug-rail-node"/>`;if(edge.river){const shared=sharedHexEdge(edge.a,edge.b);if(shared)out+=line(shared[0],shared[1],'debug-river-edge');}if(edge.bridge){const g=deriveBridgeGeometry(edge.a,edge.b);out+=`<circle cx="${g.crossing.x}" cy="${g.crossing.y}" r="3.5" class="debug-bridge-crossing"/>`;}return out;}).join('');
  const counters=model.counters.map((counter)=>{const group=model.counters.filter((other)=>coreHexKey(other.hex)===coreHexKey(counter.hex)).sort((a,b)=>a.id.localeCompare(b.id));const index=group.findIndex((other)=>other.id===counter.id);const bounds=deriveCounterBounds(counter,index,group.length);const hit=deriveTouchHitArea(counter);const anchor=hexToPixel(counter.hex);return `<g><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" class="debug-counter-bounds"/><rect x="${hit.center.x-hit.side/2}" y="${hit.center.y-hit.side/2}" width="${hit.side}" height="${hit.side}" class="debug-touch-bounds"/><path d="M${anchor.x-4} ${anchor.y} H${anchor.x+4} M${anchor.x} ${anchor.y-4} V${anchor.y+4}" class="counter-anchor-debug"/></g>`;}).join('');
  return `<g id="debug-layer">${hexes}${edges}${counters}</g>`;
}

function renderProductionGridOnly(model:BrowserRenderModel):string{
  return `<g id="production-grid-layer">${model.hexes.map((h)=>`<polygon points="${polygonPointsString(h.coord)}" class="production-grid" data-grid-hex="${coreHexKey(h.coord)}"/>`).join('')}</g>`;
}

export function coreSvgStaticMarkup(model:BrowserRenderModel,options:CoreSvgOptions):string{
  const mode=options.rendererMode??'prototype',assetSet=options.assetSet??'p5',lod=options.lod??'medium',seed=options.scenarioSeed??17;
  if(mode==='production'&&options.staticTerrainSurface)return renderProductionGridOnly(model);
  return mode==='production'?renderProductionBase(model,seed,lod,assetSet,options.marshContinuity??true):`<g id="terrain-layer">${renderTerrain(model)}</g>${renderInfrastructure(model)}`;
}

export function coreSvgDynamicMarkup(model:BrowserRenderModel,options:CoreSvgOptions):string{
  return `${renderRecoveryBases(model)}${renderDeploymentZone(model)}${renderReinforcementEntries(model)}${renderRailInteraction(model)}${renderMoveOptions(model)}${renderMovementPath(model)}${renderCombatGeometry(model)}${contactMarkers(model.playerView)}${renderCounters(model)}${options.debug?renderDebug(model):''}`;
}

export function coreSvgMarkup(model:BrowserRenderModel,options:CoreSvgOptions):string{
  const vb=viewBoxForHexes(model.hexes),mode=options.rendererMode??'prototype',assetSet=options.assetSet??'p5',lod=options.lod??'medium';
  const staticMarkup=coreSvgStaticMarkup(model,options),dynamicMarkup=coreSvgDynamicMarkup(model,options);
  return `<svg id="eastfront-map" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" data-renderer-mode="${mode}" data-asset-set="${assetSet}" data-lod="${lod}" viewBox="${vb.minX} ${vb.minY} ${vb.width} ${vb.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${t('map.accessible')}"><defs><filter id="counterShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-opacity=".33"/></filter><filter id="selectedShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".46"/></filter></defs><g id="map-static-layer">${staticMarkup}</g><g id="fog-surface-layer" pointer-events="none" aria-hidden="true"></g><g id="map-dynamic-layer">${dynamicMarkup}</g></svg>`;
}
