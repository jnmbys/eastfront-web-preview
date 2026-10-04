import {makeRecord,purposes} from './records.mjs';
const $=s=>document.querySelector(s),frame=$('#game');let config,report,sample,index=1,started=false,failed=false,exporting=false;
const label=()=>index===1?'暖机':`正常 ${index-1}/3`;
try{config=await(await fetch('/mp021/config.json',{cache:'no-store'})).json();$('#version').textContent=`${config.sourceSha} · 包 ${config.packageTreeSha256}`;$('#start').disabled=false;}catch{$('#status').textContent='配置读取失败，停止';}
$('#start').onclick=()=>{if(started||!$('#device').value.trim())return;started=true;$('#start').disabled=true;$('#device').disabled=true;$('#export').disabled=false;frame.src='/v/candidate/move/real/?scenario=move&snapshotFormat=snapshot-v3-map-table';$('#status').textContent='暖机：加载一次，后续保留同一局';};
addEventListener('message',e=>{if(e.source!==frame.contentWindow||e.origin!==location.origin)return;
 if(e.data?.source==='MP021-DIAG'){if(e.data.sourceSha!==config.sourceSha||e.data.diagnosticSha256!==config.diagnosticSha256){failed=true;$('#status').textContent='版本不符，请导出停止';return;}report=e.data.report;
  if(report.events.some(x=>/error|failed/.test(x.kind))){failed=true;$('#status').textContent='发生异常，请导出停止';}
 }
 if(e.data?.source!=='MP021-SAMPLE'||e.data.index!==index)return;
 if(e.data.type==='result'){sample=e.data;return;}
 if(e.data.type==='failure'){failed=true;$('#status').textContent='发生异常，请导出并停止';return;}
 if(failed)return;
 $('#status').textContent=e.data.type==='ready'?`${label()}：五秒已到，确认移动一次`:e.data.type==='restored'?`${label()}：已恢复操作，请导出`:e.data.type==='submitted'?`${label()}：等待权威结果及合法选项`:e.data.type==='waiting'?`${label()}：选好合法目标后，保持前台五秒（剩余 ${Math.ceil(e.data.remainingMs/1000)} 秒）`:`${label()}：选择仍有 MP 的己方棋子→移动→相邻合法目标`;
});
$('#export').onclick=()=>{if(!started||exporting)return;exporting=true;$('#export').disabled=true;sample=null;
 frame.contentWindow.postMessage({source:'MP021',type:'export'},location.origin);frame.contentWindow.postMessage({source:'MP021-DIAG',type:'export'},location.origin);
 setTimeout(()=>{const record=makeRecord({config,device:$('#device').value,index,report,sample,exportedAt:new Date().toISOString()}),text=JSON.stringify(record,null,2);$('#fallback').value=text;$('#result').hidden=false;
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`mp021-${config.instanceId}-${index}-${purposes[index-1]}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  failed||=record.classification==='exception-or-incomplete';$('#saved').disabled=failed||index===4;$('#status').textContent=failed?'已导出异常，请停止':index===4?'四份记录已导出；确认文件保存后交回分析':'先确认本次 JSON 已实际保存，再点“已保存，继续”';
 },500);
};
$('#saved').onclick=()=>{if(failed||index>=4)return;index++;sample=null;exporting=false;$('#saved').disabled=true;$('#export').disabled=false;frame.contentWindow.postMessage({source:'MP021',type:'arm',index},location.origin);$('#status').textContent=`${label()}：同一地图选一个合法移动，不刷新页面`;};
