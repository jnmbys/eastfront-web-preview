import {diagnosticMatches,sampleOf,exportRecord} from './export.mjs';
const $=s=>document.querySelector(s),frame=$('#game');let config,attempt=null,run=null,sample=null,ended=false,started=false,failed=false;
try{const response=await fetch('/mp013/config.json',{cache:'no-store'});if(!response.ok)throw Error();config=await response.json();if(config.origin!==location.origin||config.entryVersion!=='control')throw Error();$('#version').textContent=`对照 ${config.versions.control} · 诊断 ${config.diagnosticSha256}`;$('#status').textContent='准备好后只启动一次';$('#start').disabled=false;}catch{$('#status').textContent='入口配置未能通过核对，请停止；不要反复重试。';}
$('#start').onclick=()=>{
  if(started||!config)return;if(!$('#device').value.trim()){$('#status').textContent='请先填写实际型号、系统和浏览器';return;}
  started=true;$('#start').disabled=true;$('#device').disabled=true;$('#export').disabled=false;
  attempt={at:performance.now(),clock:'parent performance.now',version:'control',scenario:'move',mode:'real'};
  $('#status').textContent='正在加载；报错时直接导出并结束';frame.src='/v/control/move/real/?snapshotFormat='+encodeURIComponent(config.snapshotFormat)+'&scenario=move';
};
addEventListener('message',e=>{
  if(ended||e.origin!==location.origin||e.source!==frame.contentWindow||!started)return;
  if(e.data?.source==='MP012'){
    if(!diagnosticMatches(e.data,config)){failed=true;$('#status').textContent='诊断版本不匹配，请导出并停止';return;}
    run=e.data;
    if(run.report?.events?.some(x=>['caught-startup-error','uncaught-error','unhandled-rejection','diagnostic-or-module-startup-failed'].includes(x.kind))){failed=true;$('#status').textContent='已记录异常，请立即导出并停止';}
  }
  if(e.data?.source==='MP010'){
    if(!failed&&e.data.type==='ready')$('#status').textContent='五秒前台等待已完成：只点一次游戏内“确认移动”，恢复操作后导出';
    if(!failed&&e.data.type==='waiting')$('#status').textContent=`目标就绪后需连续前台等待五秒，剩余 ${Math.ceil(e.data.remainingMs/1000)} 秒`;
    if(e.data.type==='setup-warning'){failed=true;$('#status').textContent='准备未完成，请导出并停止';}
    if(e.data.type==='result')sample=sampleOf(e.data,config);
  }
});
$('#export').onclick=()=>{
  if(ended||!started)return;$('#export').disabled=true;
  frame.contentWindow.postMessage({source:'MP010',type:'finish'},location.origin);
  frame.contentWindow.postMessage({source:'MP012',type:'export'},location.origin);
  // Do not invent measurements when a failed iframe cannot respond.
  setTimeout(()=>{ended=true;const data=exportRecord({config,device:$('#device').value,run,sample,attempt,exportedAt:new Date().toISOString()}),text=JSON.stringify(data,null,2);
    $('#fallback').value=text;$('#result').hidden=false;$('#status').textContent='已结束本次诊断，请保存文件；无需重试';frame.src='about:blank';
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mp013-owner-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },500);
};
