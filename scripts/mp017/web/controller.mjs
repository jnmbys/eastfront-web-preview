import {diagnosticMatches,sampleOf,exportRecord} from './export.mjs';
const $=s=>document.querySelector(s),frame=$('#game');let config,attempt,run,sample,version,pairId=crypto.randomUUID(),started=false,ending=false,failed=false,completed=[];
const showPair=()=>{$('#pair').textContent=`配对编号 ${pairId}；已完成 ${completed.length}/2`;};showPair();
try{const response=await fetch('/mp017/config.json',{cache:'no-store'});if(!response.ok)throw Error();config=await response.json();if(config.origin!==location.origin||config.versions.control!=='6ea4983047757a4a32a707a23d61f4962bca36d3'||config.versions.candidate!=='a7dfdd9c57400c6a856186a70d8fb71b118b02dc')throw Error();$('#version').textContent=`A ${config.versions.control} · B ${config.versions.candidate} · 诊断 ${config.diagnosticSha256}`;$('#status').textContent='本轮只在另行授权启动后使用；先暖机';$('#start').disabled=false;}catch{$('#status').textContent='配置核对失败，请停止';}
$('#start').onclick=()=>{
 if(started||!config||failed||completed.length>=2)return;if(!$('#device').value.trim()){$('#status').textContent='请填写实际设备型号、系统及浏览器';return;}
 version=$('#version-choice').value;if(completed.includes(version)){$('#status').textContent='本对已完成此版本，请选另一版';return;}
 started=true;ending=false;run=null;sample=null;$('#start').disabled=true;$('#export').disabled=false;
 for(const id of ['device','purpose','version-choice','new-pair'])$('#'+id).disabled=true;
 attempt={at:performance.now(),clock:'parent performance.now',version,scenario:'move',mode:'real'};
 frame.src=`/v/${version}/move/real/?scenario=move&snapshotFormat=${encodeURIComponent(config.snapshotFormat)}`;
 $('#status').textContent='加载中；遇到异常立即导出停止';
};
addEventListener('message',e=>{
 if(!started||e.origin!==location.origin||e.source!==frame.contentWindow)return;
 if(e.data?.source==='MP017-DIAG'){
  if(!diagnosticMatches(e.data,config,version)){failed=true;$('#status').textContent='诊断版本不匹配，请导出停止';return;}
  run=e.data;if(run.report?.events?.some(x=>/error|failed/.test(x.kind))){failed=true;$('#status').textContent='已记录异常，请立即导出停止';}
 }
 if(e.data?.source==='MP017'){
  if(!failed&&e.data.type==='ready')$('#status').textContent='五秒完成：确认移动一次，恢复可操作后导出';
  if(!failed&&e.data.type==='waiting')$('#status').textContent=`连续前台等待剩余 ${Math.ceil(e.data.remainingMs/1000)} 秒`;
  if(e.data.type==='setup-warning'){failed=true;$('#status').textContent='启动观察超时（原因未确定），请导出停止';}
  if(e.data.type==='result')sample=sampleOf(e.data,config,version);
 }
});
$('#export').onclick=()=>{
 if(!started||ending)return;ending=true;$('#export').disabled=true;
 frame.contentWindow.postMessage({source:'MP017',type:'finish'},location.origin);frame.contentWindow.postMessage({source:'MP017-DIAG',type:'export'},location.origin);
 setTimeout(()=>{const record=exportRecord({config,device:$('#device').value,version,pairId,purpose:$('#purpose').value,order:completed.length+1,run,sample,attempt,exportedAt:new Date().toISOString()}),text=JSON.stringify(record,null,2);
  $('#fallback').value=text;$('#result').hidden=false;frame.src='about:blank';started=false;completed.push(version);showPair();
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`mp017-${pairId}-${version}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  if(record.classification==='exception-or-incomplete')failed=true;
  $('#status').textContent=failed?'已导出异常/未完成记录，请停止，不重试':completed.length===2?'本对已完成并分别导出；这不代表性能改善':'已导出；可继续本对另一版本';
  $('#version-choice').value=version==='control'?'candidate':'control';$('#version-choice').disabled=failed||completed.length===2;$('#start').disabled=failed||completed.length===2;$('#new-pair').disabled=failed||completed.length!==2;
 },500);
};
$('#new-pair').onclick=()=>{if(started||failed||completed.length!==2)return;pairId=crypto.randomUUID();completed=[];showPair();for(const id of ['start','device','purpose','version-choice'])$('#'+id).disabled=false;$('#new-pair').disabled=true;$('#status').textContent='新一对已准备；成对观察请交替版本顺序';};
