import {NetworkPlayerSession} from '../app/multiplayer/networkSession.js';
import {LobbyClient} from '../app/multiplayer/client.js';
import {Trial} from './measure.mjs';
import {ForegroundGate} from './foreground.mjs';
const build=await (await fetch('./mp010-build.json',{cache:'no-store'})).json();
const config=await (await fetch('./multiplayer-config.json',{cache:'no-store'})).json();
const query=new URLSearchParams(location.search),scenario=query.get('scenario');
if(!isSecureContext||typeof crypto.randomUUID!=='function')throw Error('MP010 requires trusted HTTPS on tablets');
// A fresh identity per fresh iframe creates the same clean scenario. Never read/export the token.
sessionStorage.removeItem(`eastfront.mp.identity:${config.serverUrl}`);
let trial=null,input=null,entry=null,baselineStatus='',session=null,frame=0,bootSteps=new Set();
const gate=new ForegroundGate();let targetPrepared=false,preparation=null,waitTimer=null,lastWaitLabel='';
const scope=s=>JSON.stringify([s.client.state.snapshot?.matchId,s.model.viewerControllerId]);
const message=(type,data)=>parent.postMessage({source:'MP017',type,...data},location.origin);
function gateState(){
 const button=document.querySelector(scenario==='move'?'#move-commit':'#confirm-deployment');
 return gate.update(performance.now(),document.visibilityState==='visible',targetPrepared&&!!button&&!button.disabled);
}
function showWait(){
 if(trial)return;
 const state=gateState(),label=state.satisfiedAtInput?'ready':`waiting-${Math.ceil(Math.max(0,5000-state.continuousVisibleMs)/1000)}`;
 if(label!==lastWaitLabel){lastWaitLabel=label;message(state.satisfiedAtInput?'ready':'waiting',{remainingMs:Math.max(0,5000-state.continuousVisibleMs)});}
}
document.addEventListener('visibilitychange',()=>{if(!trial){gateState();showWait();}});
function pollFeedback(){
 if(!trial||trial.feedback)return;
 if(document.visibilityState==='visible'){
  const status=document.querySelector('#network-match-status')?.textContent??'';
  const kind=document.querySelector('#pending-action-layer')?'pending-marker':status!==baselineStatus?'status-change':trial.applied.size?'authoritative-result':null;
  if(kind)trial.frame(kind,performance.now());
 }
 if(!trial.feedback)frame=requestAnimationFrame(pollFeedback);
}
document.addEventListener('click',e=>{
 const button=e.target.closest?.('#confirm-deployment,#move-commit');if(!button)return;
 if(trial){trial.clicks++;return;}if(button.disabled)return;
 const ready=gateState();if(!ready.satisfiedAtInput){e.preventDefault();e.stopImmediatePropagation();showWait();return;}
 preparation=ready;clearInterval(waitTimer);
 input={at:performance.now(),kind:button.id==='move-commit'?'MOVE':'DEPLOY_INITIAL_UNIT'};
 baselineStatus=document.querySelector('#network-match-status')?.textContent??'';
 // Microtasks may run between capture and bubble listeners in native input dispatch.
 // Keep the input association through the entire click task, not just capture.
 setTimeout(()=>{input=null;},0);
},true);
const submit=NetworkPlayerSession.prototype.submit;
NetworkPlayerSession.prototype.submit=function(action){
 session=this;const previous=entry;
 if(input&&input.kind===action.type&&this.interactive)entry={inputAt:input.at,baseRevision:this.matchRevision,scope:scope(this),format:this.client.snapshotFormat,compression:this.client.socket?.extensions?.includes('permessage-deflate')?'permessage-deflate':'none'};
 try{return submit.call(this,action);}finally{entry=previous;}
};
const send=LobbyClient.prototype.send;
LobbyClient.prototype.send=function(type,payload){
 const at=performance.now(),id=send.call(this,type,payload);
 if(type==='SUBMIT_ACTION'&&id){if(!trial&&entry){trial=new Trial({...entry,requestId:id});trial.sent(at);if(trial.format!==build.snapshotFormat)trial.flags.add('snapshot-format-mismatch');frame=requestAnimationFrame(pollFeedback);}else if(trial)trial.submits++;}
 if(trial&&id){if(type==='QUERY_MATCH')trial.queries++;if(type==='RESYNC_MATCH')trial.resyncs++;}
 return id;
};
const receive=NetworkPlayerSession.prototype.receive;
NetworkPlayerSession.prototype.receive=function(m){
 session=this;const sequence=this.serverSequence,wasSyncing=this.syncing,change=this.onChange;
 this.onChange=kind=>{
  // This existing callback boundary is after canonical assignment and before synchronous UI work.
  if(trial&&(kind==='view'||kind==='resync')&&m?.messageType==='PLAYER_VIEW_SNAPSHOT'&&this.playerView===m.payload.view&&this.serverSequence===m.payload.serverSequence)
   trial.apply(scope(this),this.matchRevision,this.serverSequence,performance.now());
  return change.call(this,kind);
 };
 try{return receive.call(this,m);}finally{
  this.onChange=change;
  const consumed=m&&m.payload?.serverSequence!==sequence&&this.serverSequence===m.payload?.serverSequence&&!wasSyncing;
  if(trial&&consumed){if(m.messageType==='ACTION_ACCEPTED')trial.ack(m.requestId,m.payload.acceptedRevision,performance.now());if(m.messageType==='ACTION_REJECTED'&&m.requestId===trial.id)trial.rejected=true;}
  if(trial&&this.interactive)trial.interactive(this.matchRevision,performance.now());
 }
};
for(const type of ['offline','online','visibilitychange'])window.addEventListener(type,()=>{if(trial)trial.flags.add(type==='visibilitychange'?`visibility-${document.visibilityState}`:type);});
window.addEventListener('message',e=>{
 if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='MP017')return;
 if(e.data.type==='finish'){
  cancelAnimationFrame(frame);message('result',{build,result:trial?.result()??null,preparation,finalState:{interactive:session?.interactive??false,pendingMarker:!!document.querySelector('#pending-action-layer')}});
 }
});
await import('../app/main.js');
// Only pre-trial lobby/selection clicks. Never invokes Core or submits a gameplay action.
const timer=setInterval(()=>{
 function once(key,selector){if(bootSteps.has(key))return false;const el=document.querySelector(selector);if(!el||el.disabled)return false;bootSteps.add(key);el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true;}
 if(once('home','#multiplayer-button'))return;
 const name=document.querySelector('#mp-name');if(name&&!name.disabled){name.value='MP010 device';name.dispatchEvent(new Event('input',{bubbles:true}));}
 if(once('connect','#mp-connect')||once('room','#mp-create')||once('seat',`[data-mp-seat="${scenario==='move'?'GERMANY':'SOVIET'}"]`)||once('ready','#mp-ready'))return;
 if(document.querySelector('#network-match-status')?.dataset.interactive!=='true')return;
 if(scenario==='deployment'){
  if(once('roster','[data-deploy-unit-id]'))return;
  if(once('target','[data-role="deployment-hex"]'))return;
 }else{
  if(once('unit','[data-unit-id="G-I-01"]'))return;
  if(once('move','#move-start'))return;
  if(once('target','[data-role="move-option"][data-hex="1,1"][data-legal="true"]'))return;
 }
 const confirm=document.querySelector(scenario==='move'?'#move-commit':'#confirm-deployment');
 if(confirm&&!confirm.disabled){clearInterval(timer);targetPrepared=true;showWait();waitTimer=setInterval(showWait,100);}
},250);
setTimeout(()=>{if(!document.querySelector('#eastfront-map'))message('setup-warning',{reason:'startup-not-ready'});},180000);
