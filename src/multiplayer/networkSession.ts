import {CLIENT_NETWORK} from './config.js';
import {LobbyClient} from './client.js';
import type {AuthorizedPlayerView,ServerMessage} from './protocol.js';
import {queryDraft,type QueryDraft,type MatchSnapshot,type NetworkAction,type MatchStatus} from './gameplayProtocol.js';
import type {BrowserRenderModel} from '../core-adapter/browserProjection.js';
import {clearActionDrafts,type PresentationState} from '../state/presentation.js';
import {publishAuthorizedEvents} from '../presentation/transitionBus.js';
import {mt,type MPText} from './catalog.js';
interface ProjectionRequest {draft:QueryDraft;key:string;revision:number;requestId:string|null;}
/** Contains no GameState, engine, RNG, enemy knowledge builder or local apply path. */
export class NetworkPlayerSession {
  readonly kind='network';
  playerView:AuthorizedPlayerView;model:BrowserRenderModel;matchRevision:number;serverSequence:number;status:MatchStatus;
  visibilityRevision=0;canAct=false;syncing=false;notice:MPText|null=null;
  private unsubscribe:()=>void;private modelKey='';private failedKey='';private queued:ProjectionRequest|null=null;private flight:ProjectionRequest|null=null;private forced:NetworkAction|null=null;
  private snapshotDeadline:ReturnType<typeof setTimeout>|null=null;
  private submitting=false;private timer:ReturnType<typeof setTimeout>|null=null;private queryTimer:ReturnType<typeof setTimeout>|null=null;
  private onChange:(kind:'view'|'query'|'status'|'resync')=>void;
  constructor(readonly client:LobbyClient,readonly presentation:PresentationState,onChange:NetworkPlayerSession['onChange']){
    const snapshot=client.state.snapshot;if(!snapshot)throw new Error('Missing authorized snapshot');
    this.playerView=snapshot.view;this.model=snapshot.model;this.matchRevision=snapshot.matchRevision;this.serverSequence=snapshot.serverSequence;this.status=snapshot.status;this.canAct=snapshot.canAct;this.forced=snapshot.forcedAction;this.onChange=onChange;
    this.restoreDrafts(snapshot);
    this.unsubscribe=client.subscribe(m=>this.receive(m));
  }
  get activeViewerControllerId(){return this.model.viewerControllerId;}
  get ready(){return this.client.canMutate&&!this.syncing&&!this.flight&&!this.queued&&!this.submitting;}
  /** Local selection may change while a read-only query is in flight. */
  get canSelect(){return this.client.state.connection==='CONNECTED'&&this.client.state.synced&&!this.syncing&&!this.submitting&&this.canAct&&this.status==='ACTIVE';}
  get interactive(){return this.ready&&this.canAct&&this.status==='ACTIVE';}
  get statusText():string {
    if(this.client.state.connection!=='CONNECTED')return mt('matchLost')+' · '+mt('reconnecting');
    if(this.status==='ABORTED')return mt('aborted');
    if(this.status==='WAITING_FOR_RECONNECT')return mt('waitingReconnect');
    if(this.notice)return mt(this.notice);
    if(this.syncing||this.flight||this.queued)return mt('syncing');
    if(this.submitting||this.client.state.pending)return mt('submitting');
    if(!this.canAct&&this.playerView.phase.endsWith('_DEPLOYMENT'))return mt('opponentDeploying');
    if(!this.canAct)return mt(this.playerView.phase.endsWith('_COMBAT')?'opponentDecision':'waiting');
    return mt('connected');
  }
  renderModel():BrowserRenderModel {
    // These are presentation flags on already authorized counters, never unit state.
    const stale=this.needsProjection()&&this.modelKey!==this.key(queryDraft(this.presentation));
    const counters=this.model.counters.map(c=>{
      const counter={...c,selected:c.id===this.presentation.selectedUnitId||(!stale&&(c.combatRole==='primary'||c.combatRole==='selected'))};
      if(stale)delete counter.combatRole;return counter;
    });
    return {...this.model,playerView:this.playerView,hexes:this.playerView.hexes,edges:this.playerView.edges,counters,
      selectedCounter:counters.find(c=>c.id===this.presentation.selectedUnitId)??null,
      ...(stale?{movement:null,moveOptions:[],railRepair:null,recovery:null,entrench:null,combat:null}:{}),
      readOnly:!this.canAct||this.status!=='ACTIVE'};
  }
  private needsProjection():boolean {
    // Deployment roster/zones are entirely in the authorized snapshot. Neither
    // roster selection nor a local destination changes this server projection.
    return this.status==='ACTIVE'&&this.canAct&&!this.playerView.phase.endsWith('_DEPLOYMENT');
  }
  private key(draft:QueryDraft):string {return JSON.stringify([this.matchRevision,draft]);}
  requestProjection(p=this.presentation):void {
    if(!this.needsProjection()){this.queued=null;return;}
    const draft=queryDraft(p),key=this.key(draft);
    // Always replace the unsent intent, including A -> B -> A while A is pending.
    this.queued=key===this.modelKey||key===this.failedKey||key===this.flight?.key?null:{draft,key,revision:this.matchRevision,requestId:null};
    this.flush();
  }
  private flush():void {
    if(this.queryTimer!==null||this.flight||this.submitting||this.syncing||!this.queued||!this.client.canMutate||!this.needsProjection())return;
    // Collapse same-turn input/render notifications into one latest query. Never
    // queue Actions here, and never start another query before this one's reply.
    this.queryTimer=setTimeout(()=>{
      this.queryTimer=null;
      if(this.flight||this.submitting||this.syncing||!this.queued||!this.client.canMutate||!this.needsProjection())return;
      const request=this.queued;this.queued=null;this.flight=request;
      const id=this.client.send('QUERY_MATCH',{matchId:this.client.state.snapshot!.matchId,expectedRevision:request.revision,draft:request.draft});
      if(id===null){this.flight=null;this.queued=request;}else request.requestId=id;
    },0);
  }
  submit(action:NetworkAction):void {
    if(!this.interactive)return;
    this.submitting=true;this.notice=null;this.forced=null;
    if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);
    this.snapshotDeadline=setTimeout(()=>{this.snapshotDeadline=null;this.resync();},CLIENT_NETWORK.requestTimeoutMs);
    this.client.send('SUBMIT_ACTION',{matchId:this.client.state.snapshot!.matchId,expectedRevision:this.matchRevision,action});
  }
  resync():void {
    if(this.syncing)return;this.syncing=true;this.flight=null;this.queued=null;this.submitting=false;this.forced=null;this.notice='outdated';
    if(this.queryTimer!==null)clearTimeout(this.queryTimer);this.queryTimer=null;
    this.client.resyncMatch(this.client.state.snapshot!.matchId);
    this.onChange('status');
  }
  private restoreDrafts(next:MatchSnapshot):void {
    clearActionDrafts(this.presentation);this.presentation.selectedBattleId=next.view.pendingDecision?.battleId??next.model.combat?.battle?.battleId??null;
    if(this.presentation.selectedUnitId&&!next.view.units.some(u=>u.id===this.presentation.selectedUnitId))this.presentation.selectedUnitId=null;
    if(next.model.deployment)this.presentation.selectedDeploymentUnitId=next.model.deployment.roster.find(u=>!u.placed)?.id??null;
  }
  private receive(m:ServerMessage|null):void {
    if(!m){if(this.client.state.connection!=='CONNECTED'){this.flight=null;this.queued=null;this.submitting=false;this.syncing=true;this.forced=null;}this.onChange('status');this.flush();this.scheduleForced();return;}
    if(m.messageType==='ROOM_ERROR'){
      if(this.flight?.requestId===m.requestId){this.failedKey=this.flight.key;this.flight=null;}
      this.submitting=false;this.notice=this.client.state.error;this.onChange('query');this.flush();return;
    }
    if(!['PLAYER_VIEW_SNAPSHOT','MATCH_QUERY','ACTION_ACCEPTED','ACTION_REJECTED'].includes(m.messageType)){this.onChange('status');return;}
    if(!('matchRevision' in m.payload))return;
    const order=m.payload;
    if(order.matchId!==this.client.state.snapshot?.matchId)return;
    const resync=m.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.payload.resync;
    if(resync&&(order.serverSequence<this.serverSequence||order.matchRevision<this.matchRevision))return;
    if(!resync&&(order.serverSequence!==this.serverSequence+1||order.matchRevision>this.matchRevision+1||
      (m.messageType!=='MATCH_QUERY'&&order.matchRevision<this.matchRevision))){this.resync();return;}
    // Every ordered frame consumes sequence, even an obsolete query or a frame
    // arriving while resync is pending. Discarding presentation is not packet loss.
    this.serverSequence=order.serverSequence;
    if(this.syncing&&!resync)return;
    if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){
      const next=m.payload,changed=next.matchRevision!==this.matchRevision;
      const lost=this.playerView.units.some(u=>!next.view.units.some(n=>n.id===u.id));
      if(lost||resync)this.visibilityRevision++;
      this.playerView=next.view;this.model=next.model;this.matchRevision=next.matchRevision;this.canAct=next.canAct;this.status=next.status;this.forced=next.forcedAction;
      if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);this.snapshotDeadline=null;
      this.syncing=false;this.submitting=false;this.notice=resync?'reconnected':null;this.modelKey='';this.failedKey='';
      // An unsolicited snapshot doesn't acknowledge an outstanding query. Keep
      // its request correlation until the actual reply consumes it.
      if(resync||m.requestId===this.flight?.requestId)this.flight=null;
      if(changed||resync){this.restoreDrafts(next);this.queued=null;}
      if(!resync)publishAuthorizedEvents(this,next.events);
      this.onChange(resync?'resync':'view');
    }else if(m.messageType==='MATCH_QUERY'){
      const request=this.flight;
      if(order.matchRevision>this.matchRevision){this.resync();return;}
      if(request&&request.requestId===m.requestId){
        this.flight=null;
        if(order.matchRevision===this.matchRevision&&request.key===this.key(queryDraft(this.presentation))){
          this.model={...m.payload.model,playerView:this.playerView,hexes:this.playerView.hexes,edges:this.playerView.edges};
          this.modelKey=request.key;this.forced=m.payload.forcedAction;this.notice=null;this.queued=null;this.onChange('query');
        }else{this.requestProjection();this.onChange('status');}
      }
    }else if(m.messageType==='ACTION_REJECTED'){
      if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);this.snapshotDeadline=null;
      this.submitting=false;this.notice=m.payload.code==='STALE_REVISION'?'outdated':'actionRejected';
      if(m.payload.code==='STALE_REVISION'){this.resync();return;}this.onChange('query');
    }
    this.flush();this.scheduleForced();
  }
  private scheduleForced():void {
    if(this.timer!==null)clearTimeout(this.timer);
    this.timer=setTimeout(()=>{this.timer=null;if(this.interactive&&this.forced&&!this.queued){const action=this.forced;this.forced=null;this.submit(action);}},0);
  }
  dispose():void {this.unsubscribe();if(this.snapshotDeadline!==null)clearTimeout(this.snapshotDeadline);if(this.timer!==null)clearTimeout(this.timer);if(this.queryTimer!==null)clearTimeout(this.queryTimer);this.client.dispose();}
}
