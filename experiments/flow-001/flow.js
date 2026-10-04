import { defaultRules, defaultScenario, RulesEngine } from '../../app/core-adapter/core.js';
import { sessionPlayerView } from '../../app/core-adapter/session.js';

// A deliberately closed capability: this frozen local Core has no industry extension.
// Inspect schema names, never enemy units or all-state legal-action queries.
const stateKeys = 'scenarioId rulesVersion turn phase activeSide hexes edges units controllers rp cp random victory pendingDecision phaseReadyControllerIds unitCommitments combatTransactions schwerpunktUsedOnTurn idCounters actionLog'.split(' ').sort().join('|');
const sessions = new WeakMap();
function controls(s) {
    if (!sessions.has(s)) sessions.set(s, { enabled: new Set(), generation: 0, attempted: new Set(), notice: '试验默认关闭；关闭后立即停止后续自动准备。' });
    return sessions.get(s);
}
export function enabled(s) { return !!s && controls(s).enabled.has(s.activeViewerControllerId); }
export function setEnabled(s, value) {
    const c = controls(s);
    value ? c.enabled.add(s.activeViewerControllerId) : c.enabled.delete(s.activeViewerControllerId);
    c.generation++;
    c.notice = value ? '已开启本人的空恢复自动准备；其他阶段仍需手动确认。' : '已恢复原操作模式；已生效的动作不撤销。';
}
export function eligibility(s, p) {
    if (!s || !(s.engine instanceof RulesEngine) || s.rules !== defaultRules || s.scenario !== defaultScenario)
        return { ok: false, reason: '本轮只支持固定版本的本机对局；联机保留原操作。' };
    const state = s.state;
    if (Object.keys(state).sort().join('|') !== stateKeys || state.rulesVersion !== defaultRules.id || state.scenarioId !== defaultScenario.id)
        return { ok: false, reason: '未知状态或扩展：请手动处理，工业选择不会自动通过。' };
    if (p.privacyGate || s.viewOverride || s.integrityIssues?.length || state.pendingDecision || state.victory?.winner !== null || s.pendingRequest || s.inFlight)
        return { ok: false, reason: '当前状态不能确定为空，请手动操作。' };
    if (!['GERMAN_RECOVERY', 'SOVIET_RECOVERY'].includes(state.phase))
        return { ok: false, reason: '仅检查空恢复；补给、铁路、移动、战斗、增援及筑垒保留确认。' };
    const controller = state.controllers[s.activeViewerControllerId];
    if (!controller || controller.side !== state.activeSide || state.phaseReadyControllerIds.includes(controller.id))
        return { ok: false, reason: '等待当前控制者操作或其他控制者准备。' };
    const view = sessionPlayerView(s);
    if (view.viewer !== controller.side || view.pendingDecision || !Array.isArray(view.units))
        return { ok: false, reason: '己方投影未就绪，请手动操作。' };
    const own = view.units.filter(u => u.side === view.viewer);
    // This projection includes every living friendly unit, even outside vision.
    // Any damage (including a teammate's) is conservatively treated as a choice.
    if (own.some(u => !u.friendly || !Number.isInteger(u.step) || u.step !== 0 || 'extensions' in u.friendly))
        return { ok: false, reason: '己方存在受损单位或未知资料；保留恢复选择。' };
    return { ok: true, reason: '己方存活单位均无步损；只提交本人恢复准备，仍等待全部控制者。' };
}
function token(s, p) {
    return { state: s.state, controller: s.activeViewerControllerId, generation: controls(s).generation, selected: p.selectedUnitId };
}
function current(s, p, t) {
    return s.state === t.state && s.activeViewerControllerId === t.controller && controls(s).generation === t.generation && !p.privacyGate;
}
export function autoTicket(s, p) {
    if (!enabled(s) || !eligibility(s, p).ok) return null;
    const key = `${s.state.turn}:${s.state.phase}:${s.activeViewerControllerId}`;
    if (controls(s).attempted.has(key)) return null;
    return { ...token(s, p), key };
}
export function runAuto(s, p, ticket, ready) {
    if (!ticket || !current(s, p, ticket) || !enabled(s) || !eligibility(s, p).ok || controls(s).attempted.has(ticket.key)) return false;
    controls(s).attempted.add(ticket.key); // No automatic retries, including rejected requests.
    ready(s, p); // Original intent owns the ready barrier, state update, and privacy gate.
    controls(s).notice = s.lastResult?.accepted
        ? '已自动提交本人空恢复准备；筑垒操作仍需本人确认，队友仍须自行准备。'
        : '自动准备未成功，已停下。请查看原规则反馈并手动处理。';
    return true;
}
// Single-phase command only. No queued cross-phase payments or atomic-plan claim.
export function commandTicket(s, p, intent) {
    const t = token(s, p); let used = false;
    return () => {
        if (used || !current(s, p, t) || p.selectedUnitId !== t.selected) {
            setEnabled(s, false);
            controls(s).notice = '旧版本操作已停止；请查看当前状态后重新选择。';
            return false;
        }
        used = true;
        intent(s, p);
        if (s.lastResult?.accepted === false) {
            setEnabled(s, false);
            controls(s).notice = '本次动作失败，已关闭自动准备；未重试或继续，费用以原账本为准。';
        }
        return true;
    };
}
export function controlsMarkup(s, p) {
    const supported = s?.engine instanceof RulesEngine;
    return `<section class="panel-block flow-controls"><span class="eyebrow">FLOW-001 · 本机流程试验</span><label><input id="flow-auto" type="checkbox" ${enabled(s) ? 'checked' : ''} ${supported ? '' : 'disabled'}> 自动通过空阶段（仅空恢复）</label><p>${eligibility(s, p).reason}</p><p role="status">${controls(s).notice}</p><details><summary>范围与回退</summary><p>本人的选项默认关闭；取消勾选即停止后续自动准备。恢复原版整备布局：移除网址中的 flow001=1。联机不自动提交；未覆盖工业扩展。换边与隐私交接保持原样。</p><p>整备采用连续入口，仍分阶段确认。本轮不提供跨阶段一键计划，也不提供原子回滚。</p></details></section>`;
}
export function refitMarkup(model) {
    const recovery = model.phase.endsWith('_RECOVERY');
    return `<div class="flow-refit"><strong>整备 · ${recovery ? '1 / 2 恢复' : '2 / 2 筑垒'}</strong><p>${recovery ? '先在地图选择受损单位，查看原规则资格与 RP 费用。筑垒尚未开始，不会提前生效。' : '恢复阶段已结束；此处重新按当前状态检查筑垒资格。选择地图单位安排筑垒。'}</p><p>${recovery ? '完成恢复后进入筑垒，再逐项确认。' : '已确认的动作不回滚；未确认的筑垒不会执行。'}</p></div>`;
}
