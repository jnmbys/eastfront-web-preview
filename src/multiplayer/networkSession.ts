import {CLIENT_NETWORK} from './config.js';
import {LobbyClient} from './client.js';
import type {AuthorizedPlayerView,ServerMessage} from './protocol.js';
import {queryDraft,type QueryDraft,type MatchSnapshot,type NetworkAction,type MatchStatus} from './gameplayProtocol.js';
import type {BrowserRenderModel} from '../core-adapter/browserProjection.js';
import {clearActionDrafts,type PresentationState} from '../state/presentation.js';
import {publishAuthorizedEvents} from '../presentation/transitionBus.js';
import {mt,type MPText} from './catalog.js';
/** Contains no GameState, engine, RNG, enemy knowledge builder or local apply path. */
export class NetworkPlayerSession {
  readonly kind='network';
  playerView:AuthorizedPlayerView;model:BrowserRenderModel;matchRevision:number;serverSequence:number;status:MatchStatus;
  visibilityRevision=0;canAct=false;syncing=false;notice:MPText|null=null;
  private unsubscribe:()=>void;private draftKey='';private queued:QueryDraft|null=null;private forced:NetworkAction|null=null;
  private snapshotDeadline:ReturnType<typeof setTimeout>|null=null;
  private queryPending=false;private submitting=false;private timer:ReturnType<typeof setTimeout>|null=null;
  private onChange:(kind:'view'|'query'|'status'|'resync')=>void;
  constructor(readonly client:LobbyClient,readonly presentation:PresentationState,onChange:NetworkPlayerSession['onChange']){
    const snapshot=client.state.snapshot;if(!snapshot)throw new Error('Missing authorized snapshot');
    this.playerView=snapshot.view;this.model=snapshot.model;this.matchRevision=snapshot.matchRevision;this.serverSequence=snapshot.serverSequence;this.status=snapshot.status;this.canAct=snapshot.canAct;this.forced=snapshot.forcedAction;this.onChange=onChange;
    this.unsubscribe=client.subscribe(m=>this.receive(m));
  }
  get activeViewerControllerId(){return this.model.viewerControllerId;}
  get ready(){return this.client.canMutate&&!this.syncing&&!this.queryPending&&!this.submitting;}
  get interactive(){return this.ready&&this.canAct&&this.status==='ACTIVE';}
  get statusText():string {
    if(this.client.state.connection!=='CONNECTED')return mt('matchLost')+' · '+mt('reconnecting');
    if(this.status==='ABORTED')return mt('aborted');
    if(this.status==='WAITING_FOR_RECONNECT')return mt('waitingReconnect');
    if(this.notice)return mt(this.notice);
    if(this.syncing||this.queryPending)return mt('syncing');
    if(this.submitting||this.client.state.pending)return mt('submitting');
    if(!this.canAct&&this.playerView.phase.endsWith('_DEPLOYMENT'))return mt('opponentDeploying');
    if(!this.canAct)return mt(this.playerView.phase.endsWith('_COMBAT')?'opponentDecision':'waiting');
    return mt('connected');
  }
  renderModel():BrowserRenderModel {
    return {...this.model,playerView:this.playerView,hexes:this.playerView.hexes,edges:this.playerView.edges,readOnly:!this.canAct||this.status!=='ACTIVE'};
  }
  requestProjection(p=this.presentation):void {
    if(this.status!=='ACTIVE'){this.queued=null;return;}
    const draft=queryDraft(p),key=JSON.stringify([this.matchRevision,draft]);
    if(key===this.draftKey)return;this.queued=draft;this.flush();
  }
  private flush():void {
    if(!this.ready||!this.queued||this.status!=='ACTIVE')return;
    const draft=this.queued;this.queued=null;this.queryPending=true;this.draftKey=JSON.stringify([this.matchRevision,draft]);
    this.client.send('QUERY_MATCH',{matchId:this.client.state.snapshot!.matchId,expectedRevision:this.matchRevision,draft});
  }
  submit(action:NetworkAction):void {
    if(!this.interactive)return;
    this.submitting=true;this.notice=null;this.forced=null;
    if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);
    this.snapshotDeadline=setTimeout(()=>{this.snapshotDeadline=null;this.resync();},CLIENT_NETWORK.requestTimeoutMs);
    this.client.send('SUBMIT_ACTION',{matchId:this.client.state.snapshot!.matchId,expectedRevision:this.matchRevision,action});
  }
  resync():void {
    if(this.syncing)return;this.syncing=true;this.queryPending=false;this.submitting=false;this.forced=null;this.notice='outdated';
    // Called after an inbound message settles the outstanding transport request.
    this.client.resyncMatch(this.client.state.snapshot!.matchId);
    this.onChange('status');
  }
  private receive(m:ServerMessage|null):void {
    if(!m){if(this.client.state.connection!=='CONNECTED'){this.queryPending=false;this.submitting=false;this.syncing=true;this.forced=null;}this.onChange('status');return;}
    if(m.messageType==='ROOM_ERROR'){this.queryPending=false;this.submitting=false;this.notice=this.client.state.error;this.onChange('status');return;}
    if(!['PLAYER_VIEW_SNAPSHOT','MATCH_QUERY','ACTION_ACCEPTED','ACTION_REJECTED'].includes(m.messageType)){this.onChange('status');return;}
    if(!('matchRevision' in m.payload))return;
    const order=m.payload;
    if(order.matchId!==this.client.state.snapshot?.matchId)return;
    const resync=m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync;
    if(!resync&&(order.serverSequence!==this.serverSequence+1||order.matchRevision<this.matchRevision||order.matchRevision>this.matchRevision+1)){this.resync();return;}
    if(this.syncing&&!resync)return;
    this.serverSequence=order.serverSequence;
    if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){
      const next=m.payload,changed=next.matchRevision!==this.matchRevision;
      const lost=this.playerView.units.some(u=>!next.view.units.some(n=>n.id===u.id));
      if(lost||resync)this.visibilityRevision++;
      this.playerView=next.view;this.model=next.model;this.matchRevision=next.matchRevision;this.canAct=next.canAct;this.status=next.status;this.forced=next.forcedAction;
      if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);this.snapshotDeadline=null;
      this.syncing=false;this.submitting=false;this.queryPending=false;this.notice=resync?'reconnected':null;this.draftKey='';
      if(changed||resync){clearActionDrafts(this.presentation);this.presentation.selectedBattleId=next.view.pendingDecision?.battleId??next.model.combat?.battle?.battleId??null;
        if(this.presentation.selectedUnitId&&!next.view.units.some(u=>u.id===this.presentation.selectedUnitId))this.presentation.selectedUnitId=null;
        if(next.model.deployment){this.presentation.selectedDeploymentUnitId=next.model.deployment.roster.find(u=>!u.placed)?.id??null;}
        this.queued=null;
      }
      if(!resync)publishAuthorizedEvents(this,next.events);
      this.onChange(resync?'resync':'view');
    }else if(m.messageType==='MATCH_QUERY'){
      this.queryPending=false;
      if(order.matchRevision!==this.matchRevision){this.resync();return;}
      this.model={...m.payload.model,playerView:this.playerView,hexes:this.playerView.hexes,edges:this.playerView.edges};this.forced=m.payload.forcedAction;this.notice=null;this.onChange('query');
    }else if(m.messageType==='ACTION_REJECTED'){
      if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);this.snapshotDeadline=null;
      this.submitting=false;this.notice=m.payload.code==='STALE_REVISION'?'outdated':'actionRejected';
      if(m.payload.code==='STALE_REVISION'){this.resync();return;}this.onChange('status');
    }
    this.flush();
    if(this.timer!==null)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.timer=null;if(this.interactive&&this.forced&&!this.queued){const action=this.forced;this.forced=null;this.submit(action);}},0);
  }
  dispose():void {this.unsubscribe();if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);if(this.timer!==null)clearTimeout(this.timer);this.client.dispose();}
}
