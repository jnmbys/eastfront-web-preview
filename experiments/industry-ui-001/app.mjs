import { createDemoAdapter } from './demo-adapter.mjs';
import { render } from './view.mjs';
import { RECORDS_012 } from './records-012.mjs';
import { mapRecord } from './record-adapter.mjs';
import { renderRecord } from './record-view.mjs';
import { RECORDS_013 } from './records-013.mjs';
import { mapPersonnelRecord } from './personnel-adapter.mjs';
import { renderPersonnel } from './personnel-view.mjs';
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
const personnelCheckpoint=document.getElementById('personnel-checkpoint');
for(const kind of ['CHECKPOINT','VIEWS_SAMPLE']){
  const group=document.createElement('optgroup');group.label=kind==='CHECKPOINT'?'7个离线检查点':'原VIEWS全部18条样例';
  for(const record of RECORDS_013.records.filter(r=>r.kind===kind)){
    const option=document.createElement('option');option.value=record.id;option.textContent=`${record.view.origin} · ${record.sourceLabel}`;group.append(option);
  }
  personnelCheckpoint.append(group);
}
personnelCheckpoint.value='checkpoint:T8';
const displayPersonnel=()=>renderPersonnel(mapPersonnelRecord(RECORDS_013.records.find(r=>r.id===personnelCheckpoint.value),RECORDS_013.sourceCommit),RECORDS_013);
personnelCheckpoint.addEventListener('change',displayPersonnel);
document.getElementById('mode').addEventListener('change',event=>{
  mode=event.target.value;
  const records=mode==='records';
  const personnel=mode==='personnel';
  document.getElementById('demo-content').hidden=mode!=='demo';
  document.getElementById('demo-content').inert=mode!=='demo';
  document.getElementById('records-content').hidden=!records;
  document.getElementById('checkpoint-control').hidden=!records;
  document.getElementById('personnel-content').hidden=!personnel;
  document.getElementById('personnel-checkpoint-control').hidden=!personnel;
  document.getElementById('mode-banner').textContent=mode!=='demo'?`${personnel?'013人员与装备':'012'}隔离实验记录 · 只读静态数据，非实时连接`:'演示数据，尚未连接真实工业接口';
  document.getElementById('mode-banner-note').textContent=mode!=='demo'?'REAL / SYNTHETIC 按原记录标识':'本机隔离演练 · 所有结果均为模拟';
  document.getElementById('mode-description').textContent=mode!=='demo'?'仅浏览保存的检查点，切换不推进游戏；三种模式的记录独立。':'演示数据与012、013记录分离，切换模式不会改动任何实验账本。';
  if(records)displayRecord();
  if(personnel)displayPersonnel();
});
