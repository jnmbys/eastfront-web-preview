import {LocalMatch} from './LocalMatch.js';
import {prepareLocalScenario} from './scenarios.js';
import type {LocalRequest,LocalReply} from '../../src/local-ai/types.js';
const scope=self as unknown as {onmessage:((e:MessageEvent<LocalRequest>)=>void)|null;postMessage:(v:LocalReply)=>void};
let match:LocalMatch|null=null,epoch=0,timer:ReturnType<typeof setTimeout>|null=null;
const send=(message:LocalReply['message'],takeover=false)=>{if(match)scope.postMessage({epoch,message,meta:match.meta,...(takeover?{takeover:true}:{})});};
function schedule(){if(timer!==null||!match?.shouldThink)return;timer=setTimeout(()=>{timer=null;if(!match)return;try{send(match.think());schedule();}catch{match.pause('WORKER_ERROR');send(match.snapshot());}},40);}
scope.onmessage=event=>{
 const message=event.data;
 if(message.kind==='START'){
  epoch=message.epoch;if(timer!==null)clearTimeout(timer);timer=null;
  const current=epoch;const prepared=prepareLocalScenario(message.options);
  if(current!==epoch)return;match=new LocalMatch(prepared.session,message.options.humanSide,prepared.policy);send(match.snapshot(true));schedule();return;
 }
 if(message.epoch!==epoch||!match)return;
 if(message.kind==='TAKEOVER'){if(timer!==null)clearTimeout(timer);timer=null;send(match.takeOver(),true);return;}
 for(const response of match.request(message.type,message.payload,message.requestId))send(response);
 schedule();
};
