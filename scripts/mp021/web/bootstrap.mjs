import {NetworkPlayerSession} from '../app/multiplayer/networkSession.js';
import {ForegroundGate} from '../mp017/foreground.mjs';
import {safeTiming,purposes} from './records.mjs';
if(!isSecureContext)throw Error('Trusted HTTPS required on device');
const config=await(await fetch('./multiplayer-config.json',{cache:'no-store'})).json();
sessionStorage.removeItem(`eastfront.mp.identity:${config.serverUrl}`);
let session,index=1,events=[],flags=[],submitted=false,armed=true,foreground=null,lastLabel='',gate=new ForegroundGate();
const post=(type,data={})=>parent.postMessage({source:'MP021-SAMPLE',type,index,...data},location.origin);
for(const method of ['receive','requestProjection','submit']){const original=NetworkPlayerSession.prototype[method];NetworkPlayerSession.prototype[method]=function(...args){session=this;return original.apply(this,args);};}
const state=()=>gate.update(performance.now(),document.visibilityState==='visible',!!session?.interactive&&!!document.querySelector('#move-commit:not(:disabled)'));
setInterval(()=>{if(!armed||submitted)return;const s=state(),label=s.satisfiedAtInput?'ready':`wait-${Math.ceil(Math.max(0,5000-s.continuousVisibleMs)/1000)}`;if(label!==lastLabel){lastLabel=label;post(label==='ready'?'ready':'waiting',{remainingMs:Math.max(0,5000-s.continuousVisibleMs)});}},100);
document.addEventListener('click',e=>{if(!e.target.closest?.('#move-commit'))return;
 const s=state();if(!armed||submitted||!s.satisfiedAtInput){e.preventDefault();e.stopImmediatePropagation();return;}
 foreground=s;
},true);
for(const [name,event]of [['eastfront-action-timing','action'],['eastfront-transport-timing','transport']])addEventListener(name,e=>{
 if(!armed)return;events.push(safeTiming(event,e.detail));if(events.length>1024){events.shift();flags.push('metadata-overflow');}
 // Observe brief query waits too, even if they finish between 100ms UI ticks.
 if(!submitted)state();
 if(e.detail.stage==='send'&&e.detail.type==='SUBMIT_ACTION'){submitted=true;post('submitted');}
 if(e.detail.type==='ACTION_REJECTED'||e.detail.type==='RESYNC_MATCH'){flags.push('recovery-or-rejection');post('failure');}
 if(e.detail.type==='transport-status'&&e.detail.syncing){flags.push('connection-interrupted');post('failure');}
 if(submitted&&session?.interactive&&!session?.pendingAction)post('restored');
});
for(const type of ['offline','error','unhandledrejection','visibilitychange'])addEventListener(type,()=>{if(!armed)return;if(type==='visibilitychange'&&document.visibilityState==='visible')return;flags.push(type);post('failure');});
addEventListener('message',e=>{if(e.source!==parent||e.origin!==location.origin||e.data?.source!=='MP021')return;
 if(e.data.type==='export'){armed=false;post('result',{events,flags,foreground,restored:!!session?.interactive&&!session?.pendingAction});}
 if(e.data.type==='arm'&&!armed&&e.data.index===index+1&&purposes[e.data.index-1]){index=e.data.index;events=[];flags=[];foreground=null;submitted=false;armed=true;gate=new ForegroundGate();lastLabel='';post('armed');}
});
await import('../app/main.js');
// Reuse MP017's first-trial setup clicks only. Never submit an action or call Core.
const steps=new Set(),once=(k,selector)=>{if(steps.has(k))return false;const el=document.querySelector(selector);if(!el||el.disabled)return false;steps.add(k);el.dispatchEvent(new MouseEvent('click',{bubbles:true}));return true;};
const setup=setInterval(()=>{
 if(once('home','#multiplayer-button'))return;
 const name=document.querySelector('#mp-name');if(name&&!name.disabled){name.value='MP021 owner';name.dispatchEvent(new Event('input',{bubbles:true}));}
 if(once('connect','#mp-connect')||once('room','#mp-create')||once('seat','[data-mp-seat="GERMANY"]')||once('ready','#mp-ready'))return;
 if(!session?.interactive)return;
 if(once('unit','[data-unit-id="G-I-01"]')||once('move','#move-start')||once('target','[data-role="move-option"][data-hex="1,1"][data-legal="true"]'))return;
 if(document.querySelector('#move-commit:not(:disabled)'))clearInterval(setup);
},250);
