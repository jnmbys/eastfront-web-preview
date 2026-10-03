// Presentation only; no budget mutations, settlement rules, or service calls.
const $ = id => document.getElementById(id);
function quantity(id, value, unit) { $(id).replaceChildren(document.createTextNode(`${value} `)); const small = document.createElement('small'); small.textContent = unit; $(id).append(small); }
export function render(s, act) {
  $('clock').textContent = s.clock;
  for (const [id, key] of [['free','freeI'],['escrow','escrowI'],['spent','spentI']]) quantity(id, s[key], s.budgetUnit);
  for (const [id, key] of [['buffer','buffer'],['transit','transit'],['rear-mini','rear'],['rear','rear'],['rear-hold','rearHold'],['available','available']]) quantity(id, s[key], s.material.unit);
  quantity('initial-budget', s.quote.initialI, s.budgetUnit);
  $('production-cost').textContent = `${s.quote.costI} ${s.budgetUnit}`;
  $('handoff-cost').textContent = `${s.quote.feeI} ${s.budgetUnit}`;
  $('total-cost').textContent = `${s.totalI} ${s.budgetUnit}`;
  $('product-yield').textContent = `${s.quote.outputE2} ${s.material.unit}`;
  $('personnel').textContent = `${s.personnel} P`;
  for (const [id, value] of Object.entries({ 'product-title':s.productTitle, 'material-unit':s.material.unit,
    'material-type':`: ${s.material.type}`, 'product-description':`${s.material.name} · ${s.material.equivalence}`,
    'product-route':s.route, 'production-payment-note':s.productionPaymentNote, 'handoff-payment-note':s.handoffPaymentNote,
    'duration':`${s.quote.boundaries} 个结算边界`, 'quote-note':s.normalPath, 'order-id':s.orderId,
    'progress-note':s.progressNote, 'warehouse-name':s.warehouseName, 'rear-label':`${s.warehouseName}实际库存`,
    'capacity-label':`演示容量 ${s.capacityE2} ${s.material.unit}` })) $(id).textContent = value;
  $('spent-breakdown').textContent = `生产 ${s.productionSpentI} ${s.budgetUnit} + 交接 ${s.handoffSpentI} ${s.budgetUnit}`;
  $('expected').textContent = s.expected;
  $('status').textContent = s.statusLabel; $('status').className = `status ${s.tone}`;
  $('progress-count').textContent = `${s.progress} / ${s.quote.boundaries} 结算边界`; $('progress').max = s.quote.boundaries; $('progress').value = s.progress;
  $('notice').textContent = s.message; $('notice').className = `notice ${s.tone}`;
  $('buffer-hold').textContent = `预留空间 ${s.bufferHold} ${s.material.unit} / 容量 ${s.capacityE2}`;
  $('available-note').textContent = s.availabilityNote;
  $('capacity').textContent = `仓容占用 ${s.rear + s.rearHold} / ${s.capacityE2} ${s.material.unit}（实际 + 预留）`;
  $('steps').replaceChildren(...s.steps.map(({title, detail, done}, i) => { const li=document.createElement('li'); li.className=done?'done':''; const n=document.createElement('span'); n.className='step-number'; n.textContent=done?'✓':String(i+1).padStart(2,'0'); const b=document.createElement('b'); b.textContent=title; const p=document.createElement('small'); p.textContent=detail; li.append(n,b,p); return li; }));
  const previous = $('primary-action'), active = document.activeElement === previous;
  const button = document.createElement('button'); button.id='primary-action'; button.className='primary';
  button.textContent = s.action ? s.action.label : s.inactiveActionLabel;
  button.disabled = !s.action; button.setAttribute('aria-busy', String(s.status === 'submitting'));
  if (s.action) button.onclick = () => act(s.action.name);
  $('primary-slot').replaceChildren(button); if (active && !button.disabled) button.focus();
  $('response').value=s.response; $('response').disabled=s.terminal || s.accepted || s.status==='submitting';
  $('handoff-fault').value=s.handoffFault; $('handoff-fault').disabled=s.terminal || ['submitting','received','available'].includes(s.status);
  $('reset').disabled=s.status==='submitting';
  $('journal').replaceChildren(...[...s.log].reverse().map(event => {const li=document.createElement('li'); const stamp=document.createElement('code'); stamp.textContent=event.clock; const text=document.createElement('span'); text.textContent=event.text; li.append(stamp,text); return li;}));
}
