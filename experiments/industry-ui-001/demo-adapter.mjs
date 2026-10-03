// Local, volatile fixture only. This is NOT an INDUSTRY-012 API or authority.
export const QUOTE = Object.freeze({ initialI: 10, costI: 3, feeI: 2, outputE2: 2, boundaries: 2, expectedTurn: 7 });
const LAST_EPOCH = 24;
const MATERIAL = Object.freeze({ unit: 'E2', type: 'L', name: '轻型装备', equivalence: '2 E2 = 1 E' });
const labels = {
  draft: '尚未下单', submitting: '提交等待', rejected: '订单被拒绝', unknown: '提交未确认',
  producing: '生产中', waiting: '等待交接', transit: '在途', held: '接收受阻', received: '已到账未可用', available: '可用'
};
const buttons = {
  draft: ['submit', '提交演示订单 · 5 I'], rejected: ['submit', '重试同一演示订单'], unknown: ['submit', '重试并确认同一订单'],
  producing: ['advance', '推进结算'], waiting: ['dispatch', '模拟交接发运'],
  transit: ['receive', '模拟接收确认'], held: ['retryReceipt', '推进至下一结算并重验'],
  received: ['nextTurn', '推进至可用回合']
};
export function createDemoAdapter({ wait = () => new Promise(resolve => setTimeout(resolve, 700)), fixtureStartTurn = 5 } = {}) {
  // Local test fixture only; the page always uses the original T5 demo.
  if (!Number.isInteger(fixtureStartTurn) || fixtureStartTurn < 1 || fixtureStartTurn > LAST_EPOCH) throw Error('Invalid demo start turn');
  const quote = { ...QUOTE, expectedTurn: fixtureStartTurn + QUOTE.boundaries };
  const completionEpoch = quote.expectedTurn - 1;
  let s, generation = 0;
  const listeners = new Set();
  function reset() {
    generation++;
    s = { status: 'draft', clock: `T${fixtureStartTurn}`, epoch: fixtureStartTurn, turn: fixtureStartTurn, progress: 0,
      freeI: 10, escrowI: 0, productionSpentI: 0, handoffSpentI: 0,
      produced: 0, buffer: 0, bufferHold: 0, transit: 0, rear: 0, rearHold: 0, available: 0,
      receivedEpoch: null, availableFromTurn: null, accepted: false, dispatchBlocked: false,
      orderId: 'DEMO-O-001', batchId: 'DEMO-B-001', shipmentId: 'DEMO-S-001', receiptId: 'DEMO-R-001',
      response: 'success', handoffFault: 'none', message: '先核对固定报价，再提交演示订单。', tone: 'info',
      log: [{ clock: `T${fixtureStartTurn}`, text: '演示初始化：独立预算 10 I；装备 0 E2；人员 0 P。' }] };
    emit();
  }
  function allowedAction() {
    const action = buttons[s.status];
    if (!action) return null;
    const nextEpoch = s.status === 'producing' ? fixtureStartTurn + s.progress
      : s.status === 'held' || (s.status === 'waiting' && s.dispatchBlocked) ? s.epoch + 1 : s.epoch;
    if (nextEpoch > LAST_EPOCH || (s.status === 'received' && s.availableFromTurn > LAST_EPOCH)) return null;
    return action;
  }
  function snapshot() {
    const action = allowedAction();
    const endgame = s.clock === `E${LAST_EPOCH}`;
    const terminal = endgame && !action;
    const terminalReason = s.status === 'received' ? '终局库存 · 本局不可用'
      : s.status === 'held' ? '终局 · 接收仍受阻'
      : s.status === 'waiting' ? '终局 · 交接未完成' : '终局 · 生产未完成';
    const expected = terminal ? terminalReason : s.availableFromTurn ? `T${s.availableFromTurn}`
      : endgame || quote.expectedTurn > LAST_EPOCH ? '终局结算 · 本局不可用'
      : s.status === 'held' || s.dispatchBlocked ? '已延期 · 等待实际到账' : `T${Math.max(quote.expectedTurn, s.epoch + 1)}（无阻塞）`;
    const availabilityNote = terminal ? (s.availableFromTurn ? `终局不可用；availableFromTurn=${s.availableFromTurn} 仅为账本信息，无 T${s.availableFromTurn}` : '终局未到账；余额与实物照实保留')
      : s.available ? `T${s.availableFromTurn} 已可用` : s.availableFromTurn ? `T${s.availableFromTurn} 起可用` : '尚未到账';
    let actionLabel = action?.[1];
    if (s.status === 'draft') actionLabel = `提交演示订单 · ${quote.costI + quote.feeI} I`;
    if (s.status === 'producing') actionLabel = `推进至 E${fixtureStartTurn + s.progress} · ${s.progress + 1 === quote.boundaries ? '完成生产' : `生产 ${s.progress + 1}/${quote.boundaries}`}`;
    if (s.status === 'waiting' && s.dispatchBlocked) actionLabel = '推进至下一结算并重试交接';
    if (s.status === 'received') actionLabel = `推进至 T${s.availableFromTurn} · 装备可用`;
    return structuredClone({ ...s, quote, terminal, endgame, lastEpoch: LAST_EPOCH,
      statusLabel: terminal ? terminalReason : endgame ? `终局结算 · ${labels[s.status]}` : labels[s.status],
      message: terminal ? `${terminalReason}。${availabilityNote}。不再推进 E${LAST_EPOCH + 1} 或 T${LAST_EPOCH + 1}。${s.message}` : s.message,
      budgetUnit: 'I', material: MATERIAL, totalI: quote.costI + quote.feeI, availabilityNote,
      productTitle: `${MATERIAL.name}订单`, warehouseName: 'A10 后方仓', route: '地图外生产 → A10 后方仓',
      productionPaymentNote: '接受订单时支付', handoffPaymentNote: '接受订单时托管',
      progressNote: '仅由已模拟提交的结算推进；等待时间不会生产装备。',
      normalPath: quote.expectedTurn <= LAST_EPOCH
        ? `正常路径：E${fixtureStartTurn} 进度 1/${quote.boundaries}，E${completionEpoch} 完成并交接到账，T${quote.expectedTurn} 可用。受阻后以实际到账结算为准；E${LAST_EPOCH} 到账仅保留终局库存。`
        : `本夹具预计完成时间超过 E${LAST_EPOCH} 终局；未完成订单及余额照实保留，不产生后续回合。`,
      steps: [
        { title: '下单', detail: `T${fixtureStartTurn} · 支付与托管`, done: s.accepted },
        { title: '生产', detail: `E${fixtureStartTurn} → E${completionEpoch} · ${quote.boundaries} 次结算`, done: s.progress === quote.boundaries },
        { title: '交接', detail: '实物转移至 A10', done: s.rear === quote.outputE2 },
        { title: terminal ? '终局' : '可用', detail: terminal ? terminalReason : s.availableFromTurn ? `T${s.availableFromTurn} · 次回合` : expected, done: s.available === quote.outputE2 }
      ],
      inactiveActionLabel: terminal ? '终局 · 无后续回合操作' : s.status === 'submitting' ? '提交中 · 等待模拟回执…' : '本单演示流程已完成',
      spentI: s.productionSpentI + s.handoffSpentI, capacityE2: 2, personnel: 0,
      action: action ? { name: action[0], label: actionLabel } : null,
      expected
    });
  }
  function emit() { for (const fn of listeners) fn(snapshot()); }
  function note(text, tone = 'info') {
    s.message = text; s.tone = tone; s.log.push({ clock: s.clock, text });
  }
  function check() {
    if (s.epoch > LAST_EPOCH || s.turn > LAST_EPOCH || (s.receivedEpoch === LAST_EPOCH && s.available !== 0)) throw Error('Demo terminal boundary');
    if (s.freeI + s.escrowI + s.productionSpentI + s.handoffSpentI !== 10) throw Error('Demo I invariant');
    if (s.produced !== s.buffer + s.transit + s.rear) throw Error('Demo E2 invariant');
    if (s.rear + s.rearHold > 2 || s.buffer + s.bufferHold > 2 || s.available > s.rear) throw Error('Demo capacity invariant');
  }
  function receive() {
    if (s.handoffFault === 'receipt') {
      s.handoffFault = 'none'; s.status = 'held';
      note('演示接收受阻：A10 接收资格未通过。2 E2 仍在途，仓容预留保留；不会入库或重复收费。', 'error');
    } else {
      s.transit = 0; s.rearHold = 0; s.rear = 2; s.receivedEpoch = s.epoch;
      s.availableFromTurn = s.epoch + 1; s.status = 'received';
      note(s.epoch === LAST_EPOCH ? `E${LAST_EPOCH} 模拟到账确认：2 E2 转入 A10 终局库存，可用数量仍为 0；availableFromTurn=${s.availableFromTurn} 仅作账本信息。`
        : `模拟到账确认：2 E2 转入 A10，T${s.availableFromTurn} 起可用；当前可用仍为 0。`, 'success');
    }
  }
  async function command(name) {
    if (s.status === 'submitting') return snapshot();
    // Successful duplicate submission returns the same record, with no new charge.
    if (name === 'submit' && s.accepted) return snapshot();
    if (name !== allowedAction()?.[0]) return snapshot();
    if (name === 'submit') {
      const token = generation, response = s.response;
      s.status = 'submitting'; note('提交等待：尚无接受回执；预算与库存保持不变。'); emit();
      await wait();
      if (token !== generation) return snapshot();
      s.response = 'success';
      if (response === 'reject') {
        s.status = 'rejected'; note('演示拒绝：订单窗口校验未通过。未扣费、未预留、未产出；可重试同一订单。', 'error');
      } else if (response === 'unknown') {
        s.status = 'unknown'; note('演示响应丢失：提交尚未确认。保留原请求 ID；确认前不推测付款或增加库存。', 'error');
      } else {
        s.status = 'producing'; s.accepted = true; s.freeI = 5; s.escrowI = 2; s.productionSpentI = 3; s.bufferHold = 2;
        note('演示订单已接受：支付生产费 3 I，托管交接费 2 I；装备尚未产出。', 'success');
      }
    } else if (name === 'advance') {
      s.epoch = fixtureStartTurn + s.progress; s.progress++; s.clock = `E${s.epoch}`;
      if (s.progress < quote.boundaries) note(`${s.clock} 模拟结算已提交：生产进度 ${s.progress}/${quote.boundaries}，尚无装备实物。`);
      else {
        s.produced = 2; s.buffer = 2; s.bufferHold = 0; s.status = 'waiting';
        note(`${s.clock} 模拟生产回执：2 E2 位于生产暂存，等待交接；A10 尚未到账。`, 'success');
      }
    } else if (name === 'dispatch') {
      if (s.dispatchBlocked) { s.epoch++; s.clock = `E${s.epoch}`; }
      if (s.handoffFault === 'dispatch') {
        s.handoffFault = 'none'; s.dispatchBlocked = true;
        note('演示交接拒绝：有限交接容量校验未通过。2 E2 留在生产暂存，2 I 继续托管。', 'error');
      } else {
        s.dispatchBlocked = false; s.escrowI = 0; s.handoffSpentI = 2;
        s.buffer = 0; s.transit = 2; s.rearHold = 2; s.status = 'transit';
        note('模拟交接已确认：托管 2 I 转为交接支出；2 E2 在途，A10 预留空间 2 E2。');
      }
    } else if (name === 'receive') receive();
    else if (name === 'retryReceipt') { s.epoch++; s.clock = `E${s.epoch}`; receive(); }
    else if (name === 'nextTurn') {
      s.turn = s.availableFromTurn; s.clock = `T${s.turn}`; s.available = 2; s.status = 'available';
      note(`T${s.turn} 模拟回合已开始：A10 可用 2 E2。P 仍为 0；无 C10 运输或部队恢复权限。`, 'success');
    }
    check(); emit(); return snapshot();
  }
  reset();
  return { snapshot, command, reset,
    subscribe(fn) { listeners.add(fn); fn(snapshot()); return () => listeners.delete(fn); },
    configure(key, value) {
      if (s.status === 'submitting' || snapshot().terminal) return;
      const choices = { response: ['success', 'reject', 'unknown'], handoffFault: ['none', 'dispatch', 'receipt'] };
      if (!choices[key]?.includes(value)) return;
      if (key === 'response' && s.accepted) return;
      if (key === 'handoffFault' && ['received', 'available'].includes(s.status)) return;
      s[key] = value; emit();
    }
  };
}
