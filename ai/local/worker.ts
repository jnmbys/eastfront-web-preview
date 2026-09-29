import {perf006} from '../../src/local-ai/performance.js';
import {LocalMatch} from './LocalMatch.js';
import {prepareLocalScenario} from './scenarios.js';
import type {LocalRequest,LocalReply} from '../../src/local-ai/types.js';
const scope=self as unknown as {onmessage:((e:MessageEvent<LocalRequest>)=>void)|null;postMessage:(v:LocalReply)=>void};
let policyMs=0,thinkMs=0;
let match:LocalMatch|null=null,epoch=0,timer:ReturnType<typeof setTimeout>|null=null;
const send=(message:LocalReply['message'],takeover=false,thought=false)=>{if(match)scope.postMessage({epoch,message,meta:match.meta,...(perf006.enabled?{perf:{sentAt:performance.timeOrigin+performance.now(),policyMs:thought?policyMs:0,thinkMs:thought?thinkMs:0,snapshotMs:message?.messageType==='PLAYER_VIEW_SNAPSHOT'?perf006.last('snapshotMs'):0}}:{}),...(takeover?{takeover:true}:{})});};
function schedule(){if(timer!==null||!match?.shouldThink)return;timer=setTimeout(()=>{timer=null;if(!match)return;try{policyMs=0;const start=perf006.enabled?performance.now():0;const result=match.think();thinkMs=perf006.enabled?performance.now()-start:0;send(result,false,true);schedule();}catch{match.pause('WORKER_ERROR');send(match.snapshot());}},40);}
scope.onmessage=event=>{
 const message=event.data;
 if(message.kind==='START'){
  perf006.start(message.options.performance===true);policyMs=0;thinkMs=0;epoch=message.epoch;if(timer!==null)clearTimeout(timer);timer=null;
  const current=epoch;const prepared=prepareLocalScenario(message.options);
  if(current!==epoch)return;match=new LocalMatch(prepared.session,message.options.humanSide,perf006.enabled?input=>{const start=performance.now();try{return prepared.policy(input);}finally{policyMs+=performance.now()-start;}}:prepared.policy);send(match.snapshot(true));schedule();return;
 }
 if(message.epoch!==epoch||!match)return;
 if(message.kind==='TAKEOVER'){if(timer!==null)clearTimeout(timer);timer=null;send(match.takeOver(),true);return;}
 for(const response of match.request(message.type,message.payload,message.requestId))send(response);
 schedule();
};
