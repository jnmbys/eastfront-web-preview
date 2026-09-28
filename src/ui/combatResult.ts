import type {BrowserRenderModel} from '../render/coreModel.js';
import {observePresentationTransitions} from '../presentation/transitionBus.js';
import {t,enumLabel} from '../localization/index.js';
import {escapeUi as esc} from './commandPresentation.js';
type Battle=NonNullable<NonNullable<BrowserRenderModel['combat']>['battle']>;
type Entry={battle:Battle;pending:string|null};
type View={entries:Map<string,Entry>;selected:string|null;closed:boolean;live:Set<string>;played:Set<string>;waiting:boolean;before:string|null;observed:string|null};
/** Detached authorized projections only. Never reads a session's GameState or RNG.
 * Per-session and per-viewer memory is discarded with the session, not persisted. */
export class CombatResults {
 private views=new Map<string,View>();private viewer='';private unsubscribe:()=>void;
 constructor(session:object){this.unsubscribe=observePresentationTransitions(session,events=>{const v=this.view(this.viewer);for(const e of events)if(e.kind==='combat-result'&&!v.played.has(e.battleId))v.live.add(e.battleId);});}
 private view(id:string):View {let v=this.views.get(id);if(!v){v={entries:new Map(),selected:null,closed:false,live:new Set(),played:new Set(),waiting:false,before:null,observed:null};this.views.set(id,v);}return v;}
 sync(model:BrowserRenderModel):void {
  this.viewer=model.viewerControllerId;const v=this.view(this.viewer),c=model.combat,b=c?.battle;
  for(const row of c?.history??[]){const e=v.entries.get(row.battleId);if(e){e.battle.stage=row.stage;if(row.stage==='CLOSED')e.pending=null;}}
  if(!b)return;
  v.observed=b.battleId;
  if(v.waiting&&b.battleId!==v.before)v.waiting=false;
  if(!b.resolution)return;
  const fresh=!v.entries.has(b.battleId);
  // Keep only fields already delivered to this viewer, with no shared hotseat cache.
  v.entries.set(b.battleId,{battle:structuredClone(b),pending:c?.pending?.battleId===b.battleId?c.pending.kind:null});
  if(fresh&&!v.waiting){v.selected=b.battleId;v.closed=false;}
 }
 begin():void {const v=this.view(this.viewer);v.waiting=true;v.before=v.observed;v.closed=false;}
 stopWaiting():void {this.view(this.viewer).waiting=false;}
 recover():void {for(const v of this.views.values()){v.live.clear();v.waiting=false;}}
 close():void {const v=this.view(this.viewer);v.closed=true;v.waiting=false;}
 open(id:string):boolean {const v=this.view(this.viewer);v.selected=id;v.closed=false;v.live.delete(id);v.played.add(id);return v.entries.has(id);}
 dispose():void {this.unsubscribe();this.views.clear();}
 html(model:BrowserRenderModel,reduced=false):string {
  this.sync(model);const v=this.view(this.viewer),c=model.combat;
  const waiting=v.waiting||!!(c?.battle&&!c.battle.resolution);
  const entry=v.selected?v.entries.get(v.selected):undefined;
  let body='';
  if(!v.closed&&waiting)body=`<p role="status">${t('result.waiting')}</p>`;
  else if(!v.closed&&entry){
   const b=entry.battle,r=b.resolution!,ctx=b.context,d=r.dice;
   const play=v.live.has(b.battleId)&&!v.played.has(b.battleId)&&!reduced;
   v.live.delete(b.battleId);v.played.add(b.battleId);
   const pending=c?.pending?.battleId===b.battleId?c.pending.kind:entry.pending;
   const status=b.stage==='CLOSED'?t('result.closed'):pending?t('result.pending',{kind:enumLabel(pending)}):t('result.lastStage',{stage:enumLabel(b.stage)});
   const modifiers=ctx?Object.entries(ctx.modifiers).filter(([k,n])=>k.endsWith('Shift')&&!['rawShift','cappedShift'].includes(k)&&typeof n==='number'&&n!==0).map(([k,n])=>`${t(modifierKeys[k]??'combat.modifiers')} ${Number(n)>0?'+':''}${n}`).join(' · '):'';
   body=`<div data-result-battle="${esc(b.battleId)}"><p class="result-id">${esc(b.battleId)} · ${b.targetHex.q},${b.targetHex.r}</p><div class="dice-box result-dice${play?' dice-reveal':''}" aria-label="${esc(t('combat.dice',{...d}))}"><span class="die">${d.die1}</span><span class="die">${d.die2}</span><strong>= ${d.total}</strong></div><h3 class="result-crt">${esc(r.crtResult)}</h3><p>${t('result.requirements',{a:r.attackerLossSteps,d:r.defenderLossSteps,ar:r.attackerRetreatSteps,dr:r.defenderRetreatSteps})}</p>${r.retreatConvertedToLoss?`<p>${t('result.converted')}</p>`:''}${ctx?`<div class="combat-grid"><span>${t('combat.baseOdds')}</span><strong>${esc(ctx.baseOdds)}</strong><span>${t('result.columnShift')}</span><strong>${ctx.finalShift>0?'+':''}${ctx.finalShift}</strong><span>${t('combat.finalCRT')}</span><strong>${esc(ctx.finalCRTColumnLabel)}</strong></div><small>${esc(modifiers||t('combat.flow.noModifiers'))}</small>`:''}<p class="result-note">${t('result.noDiceModifier')}</p><p role="status">${esc(status)}</p><small>${t('result.consequenceGap')}</small></div>`;
  }else if(!v.closed&&v.selected)body=`<p role="status">${t('result.unavailable')}</p>`;
  const history=new Map((c?.history??[]).map(row=>[row.battleId,row.crtResult]));for(const [id,e] of v.entries)if(!history.has(id))history.set(id,e.battle.resolution?.crtResult??null);
  const rows=[...history].reverse().map(([id,result])=>`<button type="button" class="secondary-action" data-result-history="${esc(id)}">${esc(id)} · ${esc(result??'—')}</button>`).join('');
  if(!body&&!rows)return '';
  return `<section class="panel-block combat-result-panel" aria-label="${t('result.title')}">${body?`<div class="result-heading"><strong>${t('result.title')}</strong><button type="button" class="mini-button" id="result-close">${t('result.close')}</button></div>${body}`:''}${rows?`<details class="result-history"><summary>${t('combat.history')}</summary>${rows}</details>`:''}</section>`;
 }
}
const modifierKeys:Record<string,Parameters<typeof t>[0]>={terrainShift:'common.terrain',riverShift:'combat.river',engineerShift:'combat.engineer',combinedArmsShift:'combat.combinedArms',unsupportedArmorShift:'combat.armorPenalty',antiTankShift:'combat.antiTank',attackerArtilleryShift:'combat.attackerArtillery',defenderArtilleryShift:'combat.defenderArtillery',flankShift:'combat.flank',entrenchmentShift:'combat.entrenchment',hqShift:'combat.hq',secondAttackShift:'combat.secondAttack'};
const sessions=new WeakMap<object,CombatResults>();
export function combatResults(session:object):CombatResults {let r=sessions.get(session);if(!r){r=new CombatResults(session);sessions.set(session,r);}return r;}
