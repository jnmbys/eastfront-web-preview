import type {BrowserRenderModel} from '../render/coreModel.js';
// FLOW-001 conservative empty-recovery predicate, adapted to the local Worker's
// already authorized projection. No GameState, query oracle or AI policy access.
export interface FlowContext {model:BrowserRenderModel;revision:number;ready:boolean;privacy:boolean;local:boolean;rejected:boolean;}
interface Controls {enabled:boolean;generation:number;attempted:Set<string>;notice:string;}
const sessions=new WeakMap<object,Map<string,Controls>>();
export function controls(s:object,seat:string):Controls {let seats=sessions.get(s);if(!seats){seats=new Map();sessions.set(s,seats);}let c=seats.get(seat);if(!c){c={enabled:false,generation:0,attempted:new Set(),notice:'默认关闭；只自动准备本人的空恢复。'};seats.set(seat,c);}return c;}
export function setEnabled(s:object,seat:string,on:boolean):void {const c=controls(s,seat);c.enabled=on;c.generation++;c.notice=on?'空恢复自动准备已开启；筑垒仍手动确认。':'已关闭；已执行的游戏动作不撤销。';}
export function eligible(c:FlowContext):boolean {
 const m=c.model,v=m.playerView;
 if(!c.local||!c.ready||c.privacy||c.rejected||m.readOnly||v.pendingDecision||v.victory.winner||!m.phase.endsWith('_RECOVERY')||v.activeSide!==m.viewerSide)return false;
 return v.units.filter(u=>u.side===m.viewerSide).every(u=>'friendly' in u&&!!u.friendly&&Number.isInteger(u.step)&&u.step===0&&!('extensions' in u.friendly));
}
export function autoTicket(s:object,c:FlowContext){const seat=c.model.viewerControllerId,p=controls(s,seat),key=`${c.model.turn}:${c.model.phase}:${seat}`;if(!p.enabled||p.attempted.has(key)||!eligible(c))return null;return {seat,key,revision:c.revision,generation:p.generation};}
export function runAuto(s:object,c:FlowContext,t:ReturnType<typeof autoTicket>,ready:()=>void):boolean {
 if(!t)return false;const p=controls(s,t.seat);
 if(c.model.viewerControllerId!==t.seat||c.revision!==t.revision||p.generation!==t.generation||!p.enabled||p.attempted.has(t.key)||!eligible(c))return false;
 p.attempted.add(t.key);p.notice='已提交本人空恢复准备；不自动重试，筑垒仍需确认。';ready();return true;
}
export function stopOnRejection(s:object,seat:string){const c=controls(s,seat);if(c.enabled){setEnabled(s,seat,false);c.notice='动作被拒绝；自动准备已关闭，请手动处理。';}}
export function refitMarkup(model:BrowserRenderModel):string {const recovery=model.phase.endsWith('_RECOVERY');return `<div class="flow-refit"><strong>整备 · ${recovery?'1 / 2 恢复':'2 / 2 筑垒'}</strong><p>${recovery?'先按当前资格与RP逐项恢复，结束后继续筑垒。':'恢复阶段已结束；重新检查当前筑垒资格。'}</p><small>仍分阶段确认；不提前支付、不排队执行、不回滚已完成动作。</small></div>`;}
