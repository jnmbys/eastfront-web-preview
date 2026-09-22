/* Opt-in only. Uses the browser WebSocket implementation without changing headers,
   extensions, framing or application messages. Safe output never includes payloads. */
(()=>{
 const standalone=document.currentScript?.dataset.standalone==='true';
 if(!standalone&&new URLSearchParams(location.search).get('transportDiagnostics')!=='1')return;
 const Native=window.WebSocket,rows=[],submissions=[],pending=new Map(),now=()=>performance.now();
 const ui=document.createElement('details');ui.id='transport-diagnostics';ui.open=standalone;
 ui.style.cssText='position:fixed;right:8px;bottom:8px;z-index:99999;background:#071626;color:#eee4ce;border:1px solid #aa925d;padding:10px;max-height:65vh;max-width:95vw;overflow:auto;font:13px monospace';
 ui.innerHTML='<summary>连接诊断 / Transport diagnostics</summary><button id="transport-refresh">刷新服务器证据 / Refresh</button> <button id="transport-copy">复制安全结果 / Copy</button><pre id="transport-report"></pre>';document.body.append(ui);
 const output=ui.querySelector('pre');
 let version='MP-004.1',socket=null;
 fetch(new URL('./build.json',document.currentScript.src),{cache:'no-store'}).then(r=>r.json()).then(v=>{version=v.sourceCommit;publish();}).catch(()=>{});
 function publish(){output.textContent=JSON.stringify({build:version,entry:standalone?'standalone-native':'official-game-opt-in',browser:navigator.userAgent,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},constructorNativeCodeMarker:Function.prototype.toString.call(Native).includes('[native code]'),connections:rows,submissions,boundaries:['browser implementation captured before this diagnostic; native-code marker is not proof of network path','extensions read only after OPEN','message bytes are decompressed UTF-8, NOT wire bytes','control sample is a later timer observation, NOT exact apply time or paint','handshake evidence is what reached the server, not a browser network capture','no token, cookie, unit data or full state is exported']},null,2);}
 async function refresh(row){if(!row.connectionId)return;try{const url=new URL(row.url);url.protocol=url.protocol==='wss:'?'https:':'http:';url.pathname='/transport-diagnostics/'+row.connectionId;url.search='';const response=await fetch(url,{cache:'no-store',credentials:'omit'});row.server=response.ok?await response.json():{status:response.status};}catch{row.server={error:'diagnostic fetch unavailable'};}publish();}
 function observe(ws){
  const row={url:ws.url,state:'CONNECTING',started:now(),messages:[]};rows.push(row);if(rows.length>5)rows.shift();
  const send=ws.send;ws.send=function(data){const at=now();try{const m=JSON.parse(String(data));if(m.messageType==='HELLO')row.helloSent=at;if(m.messageType==='SUBMIT_ACTION'){const s={requestId:m.requestId,expectedRevision:m.payload.expectedRevision,sentAt:at};pending.set(m.requestId,s);submissions.push(s);if(submissions.length>64){pending.delete(submissions.shift().requestId);}}if(['QUERY_MATCH','RESYNC_MATCH'].includes(m.messageType))row[m.messageType]=(row[m.messageType]??0)+1;}catch{}return send.call(this,data);};
  ws.addEventListener('open',()=>{row.state='OPEN';row.openAt=now();row.extensions=ws.extensions;let proto=Native.prototype,descriptor;while(proto&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(proto,'extensions');proto=Object.getPrototypeOf(proto);}try{row.prototypeGetterExtensions=descriptor?.get?descriptor.get.call(ws):null;}catch{row.prototypeGetterExtensions='unavailable';}row.getterMatches=row.prototypeGetterExtensions===row.extensions;publish();});
  ws.addEventListener('message',event=>{
   const arrival=now();let m;const parseStart=now();try{m=JSON.parse(String(event.data));}catch{return;}const parseMs=now()-parseStart;
   if(m.messageType==='WELCOME'){row.connectionId=m.payload.connectionId;row.helloRttMs=arrival-row.helloSent;void refresh(row);}
   if(!['ACTION_ACCEPTED','PLAYER_VIEW_SNAPSHOT','ACTION_REJECTED'].includes(m.messageType))return;
   const p=m.payload,meta={type:m.messageType,arrival,diagnosticParseMs:parseMs,bytes:new TextEncoder().encode(String(event.data)).length,revision:p.matchRevision,sequence:p.serverSequence};
   if(m.messageType==='ACTION_ACCEPTED'){meta.requestId=m.requestId;meta.acceptedRevision=p.acceptedRevision;const s=pending.get(m.requestId);if(s){s.ackAt=arrival;s.acceptedRevision=p.acceptedRevision;s.ackSequence=p.serverSequence;s.unitsAtAck=document.querySelectorAll('#counter-layer [data-unit-id]').length;}}
   if(m.messageType==='PLAYER_VIEW_SNAPSHOT'){meta.resync=p.resync;meta.hiddenEnemyUnits=p.view.phase.endsWith('_DEPLOYMENT')?p.view.units.filter(u=>u.side!==p.view.viewer).length:undefined;const s=submissions.findLast(s=>!p.resync&&s.acceptedRevision===p.matchRevision&&s.ackSequence+1===p.serverSequence);if(s){meta.requestId=s.requestId;s.snapshotArrival=arrival;s.snapshotSequence=p.serverSequence;s.snapshotBytes=meta.bytes;setTimeout(()=>{s.controlsSampleAt=now();const status=document.querySelector('#network-match-status');s.appliedRevision=Number(status?.dataset.revision);s.controlsReady=status?.dataset.interactive==='true';s.visibleUnits=document.querySelectorAll('#counter-layer [data-unit-id]').length;publish();},0);}}
   row.messages.push(meta);if(row.messages.length>64)row.messages.shift();queueMicrotask(publish);
  });
  ws.addEventListener('close',()=>{row.state='CLOSED';row.closedAt=now();publish();});publish();return ws;
 }
 ui.querySelector('#transport-refresh').onclick=()=>{for(const row of rows.filter(r=>r.state==='OPEN'))void refresh(row);};
 ui.querySelector('#transport-copy').onclick=async()=>{try{await navigator.clipboard.writeText(output.textContent);}catch{const range=document.createRange();range.selectNodeContents(output);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}};
 if(standalone){const button=document.createElement('button');button.textContent='新连接测试 / Test new connection';ui.insertBefore(button,output);button.onclick=async()=>{socket?.close();const config=await fetch('../../multiplayer-config.json',{cache:'no-store'}).then(r=>r.json());socket=observe(new Native(config.serverUrl));socket.addEventListener('open',()=>socket.send(JSON.stringify({protocolVersion:2,messageType:'HELLO',requestId:crypto.randomUUID(),payload:{displayName:'Transport diagnostic'}})));};}
 else {window.WebSocket=new Proxy(Native,{construct(target,args,newTarget){return observe(Reflect.construct(target,args,newTarget));}});}
 publish();
})();
