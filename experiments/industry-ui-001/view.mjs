// Presentation only; no budget mutations, settlement rules, or service calls.
const $ = id => document.getElementById(id);
function quantity(id, value, unit) { $(id).replaceChildren(document.createTextNode(`${value} `)); const small = document.createElement('small'); small.textContent = unit; $(id).append(small); }
export function render(s, act) {
  $('clock').textContent = s.clock;
  for (const [id, key, unit] of [['free','freeI','I'],['escrow','escrowI','I'],['spent','spentI','I'],['buffer','buffer','E2'],['transit','transit','E2'],['rear-mini','rear','E2'],['rear','rear','E2'],['rear-hold','rearHold','E2'],['available','available','E2']]) quantity(id, s[key], unit);
  $('spent-breakdown').textContent = `生产 ${s.productionSpentI} I + 交接 ${s.handoffSpentI} I`;
  $('expected').textContent = s.expected;
  $('status').textContent = s.statusLabel; $('status').className = `status ${s.tone}`;
  $('progress-count').textContent = `${s.progress} / 2 结算边界`; $('progress').value = s.progress;
  $('notice').textContent = s.message; $('notice').className = `notice ${s.tone}`;
  $('buffer-hold').textContent = `预留空间 ${s.bufferHold} E2 / 容量 ${s.capacityE2}`;
  $('available-note').textContent = s.available ? `T${s.availableFromTurn} 已可用` : s.availableFromTurn ? `T${s.availableFromTurn} 起可用` : '尚未到账';
  $('capacity').textContent = `仓容占用 ${s.rear + s.rearHold} / ${s.capacityE2} E2（实际 + 预留）`;
  const steps = [ ['下单', 'T5 · 支付与托管', s.accepted], ['生产', 'E5 → E6 · 2 次结算', s.progress === 2], ['交接', '实物转移至 A10', s.rear === 2], ['可用', s.availableFromTurn ? `T${s.availableFromTurn} · 次回合` : s.expected, s.available === 2] ];
  $('steps').replaceChildren(...steps.map(([title, detail, done], i) => { const li=document.createElement('li'); li.className=done?'done':''; const n=document.createElement('span'); n.className='step-number'; n.textContent=done?'✓':String(i+1).padStart(2,'0'); const b=document.createElement('b'); b.textContent=title; const p=document.createElement('small'); p.textContent=detail; li.append(n,b,p); return li; }));
  const previous = $('primary-action'), active = document.activeElement === previous;
  const button = document.createElement('button'); button.id='primary-action'; button.className='primary';
  button.textContent = s.action ? s.action.label : s.status === 'submitting' ? '提交中 · 等待模拟回执…' : '本单演示流程已完成';
  button.disabled = !s.action; button.setAttribute('aria-busy', String(s.status === 'submitting'));
  if (s.action) button.onclick = () => act(s.action.name);
  $('primary-slot').replaceChildren(button); if (active && !button.disabled) button.focus();
  $('response').value=s.response; $('response').disabled=s.accepted || s.status==='submitting';
  $('handoff-fault').value=s.handoffFault; $('handoff-fault').disabled=['submitting','received','available'].includes(s.status);
  $('reset').disabled=s.status==='submitting';
  $('journal').replaceChildren(...[...s.log].reverse().map(event => {const li=document.createElement('li'); const stamp=document.createElement('code'); stamp.textContent=event.clock; const text=document.createElement('span'); text.textContent=event.text; li.append(stamp,text); return li;}));
}
