import { createDemoAdapter } from './demo-adapter.mjs';
import { render } from './view.mjs';
import { RECORDS_012 } from './records-012.mjs';
import { mapRecord } from './record-adapter.mjs';
import { renderRecord } from './record-view.mjs';
const adapter = createDemoAdapter();
let mode='demo';
adapter.subscribe(state => render(state, command => { if(mode==='demo') return adapter.command(command); }));
document.getElementById('response').addEventListener('change', event => {if(mode==='demo')adapter.configure('response', event.target.value);});
document.getElementById('handoff-fault').addEventListener('change', event => {if(mode==='demo')adapter.configure('handoffFault', event.target.value);});
document.getElementById('reset').addEventListener('click', () => {if(mode==='demo')adapter.reset();});
const checkpoint=document.getElementById('checkpoint');
for(const record of RECORDS_012.records){const option=document.createElement('option'); option.value=record.label; option.textContent=`${record.view.origin} · ${record.label}`; checkpoint.append(option);}
checkpoint.value='T7';
const displayRecord=()=>renderRecord(mapRecord(RECORDS_012.records.find(r=>r.label===checkpoint.value),RECORDS_012.sourceCommit));
checkpoint.addEventListener('change',displayRecord);
document.getElementById('mode').addEventListener('change',event=>{
  mode=event.target.value;
  const records=mode==='records';
  document.getElementById('demo-content').hidden=records;
  document.getElementById('demo-content').inert=records;
  document.getElementById('records-content').hidden=!records;
  document.getElementById('checkpoint-control').hidden=!records;
  document.getElementById('mode-banner').textContent=records?'012隔离实验记录 · 只读静态数据，非实时连接':'演示数据，尚未连接真实工业接口';
  document.getElementById('mode-banner-note').textContent=records?'REAL / SYNTHETIC 按原记录标识':'本机隔离演练 · 所有结果均为模拟';
  document.getElementById('mode-description').textContent=records?'仅浏览已保存的检查点；无下单、推进结算或重试写入能力。':'演示数据与012记录分离，切换模式不会改动任何实验账本。';
  if(records)displayRecord();
});
