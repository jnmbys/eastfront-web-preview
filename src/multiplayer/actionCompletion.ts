export interface AppliedAction {
  requestId:string;revision:number;sequence:number;at:number;
}
interface Request {
  scope:string;baseRevision:number;baseSequence:number;acceptedRevision:number|null;
}
interface AppliedSnapshot {revision:number;sequence:number;at:number;}
/** Opt-in, bounded metadata only. Independent of pending UI cleanup and never gates state application. */
export class ActionCompletionDiagnostics {
  private requests=new Map<string,Request>();
  private snapshots=new Map<string,AppliedSnapshot>();
  private completed=new Set<string>();
  constructor(private publish:(record:AppliedAction)=>void){}
  private scope(matchId:string,viewerId:string):string {return JSON.stringify([matchId,viewerId]);}
  submitted(requestId:string,matchId:string,viewerId:string,baseRevision:number,baseSequence:number):void {
    if(this.requests.has(requestId)||this.completed.has(requestId))return;
    this.requests.set(requestId,{scope:this.scope(matchId,viewerId),baseRevision,baseSequence,acceptedRevision:null});
    if(this.requests.size>64)this.requests.delete(this.requests.keys().next().value!);
  }
  accepted(requestId:string|null,revision:number|null):void {
    if(!requestId||revision===null)return;
    const request=this.requests.get(requestId);if(!request||revision<=request.baseRevision)return;
    // One receipt fixes the result version; conflicting replays cannot relabel it.
    if(request.acceptedRevision!==null&&request.acceptedRevision!==revision)return;
    request.acceptedRevision=revision;this.complete(requestId,request);
  }
  applied(matchId:string,viewerId:string,revision:number,sequence:number,at:number):void {
    const scope=this.scope(matchId,viewerId),key=JSON.stringify([scope,revision]);
    // Preserve the actual first application time, even when a receipt arrives later.
    if(!this.snapshots.has(key))this.snapshots.set(key,{revision,sequence,at});
    if(this.snapshots.size>64)this.snapshots.delete(this.snapshots.keys().next().value!);
    for(const [id,request] of this.requests)if(request.scope===scope)this.complete(id,request);
  }
  private complete(id:string,request:Request):void {
    if(request.acceptedRevision===null)return;
    const snapshot=this.snapshots.get(JSON.stringify([request.scope,request.acceptedRevision]));
    if(!snapshot||snapshot.sequence<=request.baseSequence)return;
    this.requests.delete(id);this.completed.add(id);
    if(this.completed.size>128)this.completed.delete(this.completed.values().next().value!);
    this.publish({requestId:id,...snapshot});
  }
  rejected(requestId:string|null):void {if(requestId)this.requests.delete(requestId);}
  clear():void {this.requests.clear();this.snapshots.clear();this.completed.clear();}
}
