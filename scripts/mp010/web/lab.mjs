import {sampleProgress,nextVersion} from './sampling.mjs';
const $=s=>document.querySelector(s),config=await (await fetch('/lab-config.json',{cache:'no-store'})).json();
const key='mp010-safe-results-v1';let rows=[];try{rows=JSON.parse(localStorage.getItem(key)??'[]');}catch{}
let deviceRunId=localStorage.getItem('mp010-device-run-id');if(!deviceRunId&&isSecureContext){deviceRunId=crypto.randomUUID();localStorage.setItem('mp010-device-run-id',deviceRunId);}
let active=null,pending=null;
$('#config').textContent=JSON.stringify(config,null,2);
$('#security').textContent=isSecureContext?'安全上下文':'需可信 HTTPS';$('#start').disabled=!isSecureContext;
function context(){return Object.fromEntries(['device','platform','network','scenario','mode','check'].map(k=>[k,$('#'+k).value]));}
function group(r,c){return r.deviceRunId===deviceRunId&&r.samplerSha256===config.samplerSha256&&r.harnessSha256===config.harnessSha256&&['device','platform','network','scenario','mode','check'].every(k=>r[k]===c[k]);}
function update(){const c=context(),samples=rows.filter(r=>group(r,c)),counts=sampleProgress(samples,config);$('#counts').textContent=c.check==='warmup'?`暖机已保存：候选 ${samples.filter(r=>r.version==='candidate').length} 次 / 对照 ${samples.filter(r=>r.version==='control').length} 次；不计入正常样本。`:`本用途已保存 ${samples.length} 次；正常完成：候选 ${counts.candidate}/10，对照 ${counts.control}/10。异常、未完成和人工可见反馈待判读项另列。`;
 $('#export').disabled=!rows.length;}
document.querySelectorAll('#setup input,#setup select').forEach(el=>el.addEventListener('change',update));update();
$('#start').onclick=()=>{
 const c=context();if(!c.platform.trim()){alert('请填写系统和浏览器版本，便于绑定设备。');return;}
 if(c.check==='sample'&&c.mode==='timeout'){alert('12 秒条件仅用于恢复检查，请选择对应检查用途。');return;}
 const samples=rows.filter(r=>group(r,c)),n=samples.length,version=nextVersion(samples,c.check,config),counts=sampleProgress(samples,config);
 if(c.check==='sample'&&counts.candidate>=10&&counts.control>=10&&!confirm('两版均已达到 10 个正常完成样本。仍需追加吗？'))return;
 active={...c,deviceRunId,version,sourceSha:config.versions[version],serverSha:config.serverSha,snapshotFormat:config.format,samplerSha256:config.samplerSha256,harnessSha256:config.harnessSha256,seed:config.seed,delays:config.modes[c.mode],trialId:crypto.randomUUID(),ordinal:n+1,startedAt:new Date().toISOString(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
 $('#setup').hidden=true;$('#run').hidden=false;$('#instruction').textContent='正在准备对局；就绪后只点击游戏内确认。录屏需包含点击指示或可辨识的按键状态。';
 $('#version').textContent=`${version==='candidate'?'候选 A':'对照 B'} · ${active.sourceSha} · ${c.scenario} / ${c.mode} · 第 ${n+1} 次`;
 $('#game').src=`/v/${version}/${c.scenario}/${c.mode}/?snapshotFormat=${encodeURIComponent(config.format)}&scenario=${c.scenario}`;
};
$('#finish').onclick=()=>$('#game').contentWindow.postMessage({source:'MP010',type:'finish'},location.origin);
window.addEventListener('message',e=>{
 if(e.source!==$('#game').contentWindow||e.origin!==location.origin||e.data?.source!=='MP010'||!active)return;
 if(e.data.type==='waiting')$('#instruction').textContent=`目标就绪后需连续前台等待 5 秒，剩余 ${Math.ceil(e.data.remainingMs/1000)} 秒；提前确认不会提交，切后台会重新计时。`;
 if(e.data.type==='ready')$('#instruction').textContent='连续前台等待 5 秒已完成。现在点击游戏内确认；等待正式结果并再次可操作，然后结束并保存。';
 if(e.data.type==='setup-warning')$('#instruction').textContent='准备超时：可在游戏内手动进入多人、建房、选座、准备；若仍失败，结束并记录无效样本。';
 if(e.data.type==='result'){
  pending={...active,metrics:e.data.result,finalState:e.data.finalState,preparation:e.data.preparation};
  if(e.data.build.sourceSha!==active.sourceSha||e.data.build.samplerSha256!==config.samplerSha256||e.data.build.harnessSha256!==config.harnessSha256)pending.invalidBuild=true;
  $('#automatic').textContent=JSON.stringify(pending.metrics,null,2);$('#visible').value='';$('#clip').value='';$('#fps').value='';$('#visibleKind').value='unreviewed';$('#outcome').value='unreviewed';$('#review').showModal();
 }
});
$('#review').addEventListener('close',()=>{
 if($('#review').returnValue!=='save'||!pending)return;
 const value=$('#visible').value,kind=$('#visibleKind').value;
 pending.observation={visibleFeedbackMs:value===''?null:Number(value),method:value===''?'unreviewed-video':'manual-video',kind,clip:$('#clip').value.slice(0,40),fps:$('#fps').value===''?null:Number($('#fps').value),outcome:$('#outcome').value};
 if(pending.metrics){pending.metrics.visibleFeedbackMs=pending.observation.visibleFeedbackMs;pending.metrics.visibleFeedbackMethod=pending.observation.method;}
 rows.push(pending);localStorage.setItem(key,JSON.stringify(rows));active=null;pending=null;$('#game').src='about:blank';$('#run').hidden=true;$('#setup').hidden=false;update();
});
$('#export').onclick=()=>{
 const data={schema:'MP010-v1',exportedAt:new Date().toISOString(),measurement:'manual video visibility; common pre-render authorized apply boundary; common post-receive interactive; rAF opportunity only',rows};
 const json=JSON.stringify(data,null,2)+'\n';$('#exportText').textContent=json;$('#exportFallback').hidden=false;
 const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='mp010-device-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
};
