// Separate export, including failures before an MP010 action Trial exists.
const runs=new Map(),attempts=[];
const box=document.createElement('aside');box.style.cssText='padding:12px;background:#fff3cd;color:#241d08;position:relative;z-index:99';
box.innerHTML='<strong>MP-012 本地诊断 · 原两版客户端未改</strong> <button type="button" id="mp012-export">导出启动与等待诊断</button><p id="mp012-state">尚未收到诊断；这不代表启动成功。</p><textarea id="mp012-text" hidden style="width:100%;height:120px" readonly></textarea>';
document.body.prepend(box);
const instruction=document.querySelector('#setup > p');if(instruction)instruction.textContent='本轮仅作单次定位，不收十次配额。选择暖机；出现报错时直接导出上方诊断，不要反复重试。';
const frame=document.querySelector('#game');
new MutationObserver(()=>{const u=new URL(frame.src,location.href),match=u.pathname.match(/^\/v\/(candidate|control)\/(deployment|move)\/(real|delay|timeout)\/$/);if(!match)return;attempts.push({parentAt:performance.now(),version:match[1],scenario:match[2],mode:match[3],expectedSourceSha:document.querySelector('#version')?.textContent.match(/[a-f0-9]{40}/)?.[0]??null,event:'iframe-navigation-requested'});if(attempts.length>24)attempts.shift();}).observe(frame,{attributes:true,attributeFilter:['src']});
addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==document.querySelector('#game')?.contentWindow||e.data?.source!=='MP012')return;runs.set(e.data.runId,e.data);if(runs.size>12)runs.delete(runs.keys().next().value);document.querySelector('#mp012-state').textContent=`${e.data.version} · ${e.data.sourceSha??'版本尚未取得'} · ${e.data.stage} · ${runs.size} 次启动`;});
document.querySelector('#mp012-export').onclick=()=>{
  document.querySelector('#game')?.contentWindow.postMessage({source:'MP012',type:'export'},location.origin);
  setTimeout(()=>{const text=JSON.stringify({schema:'MP012-diagnostic-v1',exportedAt:new Date().toISOString(),parentAttempts:attempts,parentClock:'outer performance.now; do not subtract iframe times',runs:[...runs.values()],missingRunsPossible:true,limits:'At most 12 iframe runs, 2048 events each. Reloading outer page loses in-memory diagnostic history. No cross-frame clock subtraction.'},null,2);const area=document.querySelector('#mp012-text');area.hidden=false;area.value=text;const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='mp012-diagnostics.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},150);
};
