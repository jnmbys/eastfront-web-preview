const $=id=>document.getElementById(id),mode=new URLSearchParams(location.search).get('terrainLoad')==='serial'?'serial':'default';
const config=await fetch('/s004/config.json',{cache:'no-store'}).then(r=>r.json());
$('mode').textContent=mode==='serial'?'串行回退':'默认加载';
let snapshot=null,started=false,stopped=false,lastJSON='',receipt=null,screenshots=[];
if(mode==='serial'&&!config.serialEnabled&&location.hostname!=='127.0.0.1'){$('status').textContent='串行模式尚未开放。请先完成默认模式并保存记录。';throw Error('Serial not released');}
const game=$('game');game.onload=()=>{const doc=game.contentDocument;if(!doc.querySelector('#app'))return;const script=doc.createElement('script');script.type='module';script.src='/s004/observer.mjs';doc.head.append(script);};
game.src='/r1/index.html'+(mode==='serial'?'?terrainLoad=serial':'');
const send=type=>game.contentWindow.postMessage({startup004:type},location.origin);
function status(){if(receipt)return;if(!snapshot)return;const lods=snapshot.events.filter(e=>e.kind==='terrain-complete').map(e=>e.lod);$('status').textContent=`${started?'启动中/已启动':'已准备好，请填写设备和网络后开始'}；地形完成 ${[...new Set(lods)].join('/')||'尚无'}；地图 DOM ${snapshot.marks.mapDomReadyAt==null?'未就绪':'已出现'}；地图控件 ${snapshot.marks.controlsAvailableAt==null?'未观测到可用':'已观测到可用'}；当前景别 ${snapshot.current.lod||'无'}，缩放 ${snapshot.current.zoom||'未知'}。\n地形完成不代表画面已验收，请按实际观察勾选后保存。`;$('shot').disabled=!snapshot.current.canvas||stopped;}
window.addEventListener('message',e=>{if(e.source!==game.contentWindow||e.origin!==location.origin||!e.data?.startup004)return;
 if(e.data.startup004==='snapshot'){snapshot=e.data.data;status();if(snapshot.failed&&!stopped){stopped=true;void save('failed');}}
 if(e.data.startup004==='ready'){$('start').disabled=false;send('snapshot');}
 if(e.data.startup004==='screenshot'){screenshots.push(e.data.data);$('status').textContent=`地形截图已保存：${e.data.data.id}（${e.data.data.lod}）`;}
});
$('start').onclick=()=>{if(started||stopped)return;if(!$('device').value.trim()||!$('network').value.trim()){$('status').textContent='请先填写实际设备/浏览器和网络。';return;}started=true;$('start').disabled=true;game.style.pointerEvents='auto';send('start');};
$('shot').onclick=()=>{send('screenshot');};
const observations=()=>Object.fromEntries(['complete','drag','zoom','far','medium','close'].map(id=>[id,$(id).checked]));
async function save(requested){
 send('snapshot');await new Promise(r=>setTimeout(r,80));
 if(!snapshot){$('status').textContent='尚未取得诊断，停止操作并报告本提示，不要刷新。';return;}
 const o=observations(),mounted=new Set(snapshot.events.filter(e=>e.kind==='lod-mounted').map(e=>e.lod));
 const outcome=requested==='failed'||snapshot.failed?'failed':Object.values(o).every(Boolean)&&['far','medium','close'].every(lod=>mounted.has(lod))&&snapshot.progress.stage==='ready'&&snapshot.marks.mapDomReadyAt!=null&&snapshot.marks.controlsAvailableAt!=null?'observed-success':'incomplete';
 const data={schema:'STARTUP004-device-v1',sourceCommit:config.sourceCommit,mode,device:$('device').value||'未填',network:$('network').value||'未填',cacheCondition:$('cache').value,cachePolicy:config.cachePolicy,exportedAt:new Date().toISOString(),outcome,observations:o,notes:$('notes').value,screenshots,...snapshot};
 lastJSON=JSON.stringify(data,null,2)+'\n';$('backup').value=lastJSON;$('download').disabled=false;
 const expected=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(lastJSON)))).map(v=>v.toString(16).padStart(2,'0')).join('');
 try{const response=await fetch('/s004/records',{method:'POST',headers:{'Content-Type':'application/json'},body:lastJSON});if(!response.ok)throw Error('保存响应 '+response.status);const saved=await response.json();if(saved.sha256!==expected)throw Error('保存校验不一致');receipt=saved;$('status').textContent=`已保存到本机并校验：${saved.id}\nSHA256 ${saved.sha256}\n结果：${outcome}。请回到聊天告知已保存；不要刷新或自行重试。`;if(outcome!=='incomplete'){$('save').disabled=true;game.style.pointerEvents='none';}}
 catch(error){$('status').textContent=`本机保存未确认：${error.message}。不要刷新；请下载 JSON 或保留文本，并向本次任务报告。`;}
}
$('save').onclick=()=>void save('observed-success');$('failure').onclick=()=>{stopped=true;$('start').disabled=true;game.style.pointerEvents='none';void save('failed');};
$('download').onclick=()=>{if(!lastJSON)return;const a=document.createElement('a'),u=URL.createObjectURL(new Blob([lastJSON],{type:'application/json'}));a.href=u;a.download=`startup004-${mode}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
