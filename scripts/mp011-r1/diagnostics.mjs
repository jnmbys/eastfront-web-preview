import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const safePath=value=>/^\/ws\/(deployment|move)\/(real|delay|timeout)$/.test(value)?value:
  ['/', '/__mp010_login','/lab-config.json'].includes(value)?value:
  /^\/v\/(candidate|control)\/(deployment|move)\/(real|delay|timeout)\/(index.html|mp010-build.json|multiplayer-config.json)$/.test(value)?value:'<other>';
export function observe(req,connection,kind,write){
  const started=performance.now();
  const supplied=req.headers['x-mp011-request-id'];
  const requestId=typeof supplied==='string'&&/^mp011-[a-f0-9-]{8,60}$/.test(supplied)?supplied:'mp011-'+randomUUID();
  const ray=req.headers['cf-ray'];
  const base={requestId,path:safePath(req.url),method:['GET','POST','HEAD','OPTIONS'].includes(req.method)?req.method:'OTHER',kind,cfRay:typeof ray==='string'&&/^[a-f0-9]{16,32}-[A-Z]{3}$/.test(ray)?ray:null};
  let status=null,reason=null;
  const emit=(event,extra={})=>write({...base,at:new Date().toISOString(),elapsedMs:performance.now()-started,event,status,reason,...extra});
  emit('received');
  connection.once('finish',()=>emit('response-finish',{status:kind==='http'?connection.statusCode:status,meaning:'local-write-complete-not-peer-ack'}));
  connection.once('close',hadError=>emit('connection-close',{hadError:!!hadError}));
  connection.once('error',error=>emit('connection-error',{errorCode:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'OTHER'}));
  return {decision:(nextStatus,nextReason)=>{status=nextStatus;reason=nextReason;emit('decision');},error:error=>emit('upstream-error',{errorCode:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'OTHER'})};
}
