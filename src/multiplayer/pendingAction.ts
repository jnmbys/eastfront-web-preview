import type {HexCoord} from '../core-adapter/core.js';
import type {NetworkAction} from './gameplayProtocol.js';
import type {MPText} from './catalog.js';

export interface PendingIntent {
  requestId:string|null;matchId:string;viewerId:string;phase:string;
  baseRevision:number;baseSequence:number;startedAt:number;
  kind:'deployment'|'move';unitId:string;origin:HexCoord|null;path:readonly HexCoord[];
  stage:'submitting'|'accepted';acceptedRevision:number|null;
}
/** Client-only intent. Never enters a model, QueryDraft, protocol or FOW input. */
export class PendingActionTracker {
  current:PendingIntent|null=null;
  notice:MPText|null=null;
  private applied=new Map<number,number>();
  begin(action:NetworkAction,context:Omit<PendingIntent,'requestId'|'kind'|'unitId'|'path'|'stage'|'acceptedRevision'>):boolean {
    this.clear();
    if(action.type!=='DEPLOY_INITIAL_UNIT'&&action.type!=='MOVE')return false;
    this.current={...context,requestId:null,kind:action.type==='MOVE'?'move':'deployment',unitId:action.type==='MOVE'?action.unitId:action.deploymentUnitId,
      path:structuredClone(action.type==='MOVE'?action.path:[action.hex]),stage:'submitting',acceptedRevision:null};
    return true;
  }
  bind(requestId:string):void {if(this.current)this.current.requestId=requestId;}
  matches(requestId:string|null):boolean {return !!requestId&&this.current?.requestId===requestId;}
  accepted(requestId:string|null,revision:number|null):boolean {
    const p=this.current;if(!p||!this.matches(requestId)||revision===null||revision<=p.baseRevision)return false;
    p.acceptedRevision=revision;
    if(this.applied.has(revision)){this.clear();return true;}
    p.stage='accepted';return false;
  }
  snapshot(revision:number,sequence:number):boolean {
    const p=this.current;if(!p||revision<=p.baseRevision||sequence<=p.baseSequence)return false;
    // Do not guess action identity from position or an arbitrary newer snapshot.
    this.applied.set(revision,sequence);if(this.applied.size>16)this.applied.delete(this.applied.keys().next().value!);
    if(p.acceptedRevision===revision){this.clear();return true;}return false;
  }
  reject(requestId:string|null,reason:MPText):boolean {
    if(!this.matches(requestId))return false;this.clear();this.notice=reason;return true;
  }
  uncertain():void {if(this.current){this.clear();this.notice='resultUncertain';}}
  clear():void {this.current=null;this.notice=null;this.applied.clear();}
  get text():MPText|null {return this.notice??(this.current?(this.current.stage==='accepted'?'acceptedSyncing':'submitting'):null);}
}
