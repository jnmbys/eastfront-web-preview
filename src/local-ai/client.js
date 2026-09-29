import { perf006 } from './performance.js';
/** In-process transport facade only. Receives authorized DTOs, never GameState or agent inputs. */
export class LocalAiClient {
    port;
    update;
    state = { connection: 'DISCONNECTED', controllerId: null, snapshot: null, room: null, match: null, view: null, pending: false, synced: false, error: null };
    get canMutate() { return !this.dead && !this.faulted && this.state.connection === 'CONNECTED' && this.state.synced && !this.state.pending; }
    callbacks = new Set();
    dead = false;
    faulted = false;
    started = false;
    epoch = 1;
    meta;
    bootResolve = null;
    bootReject = null;
    takeoverResolve = null;
    takeoverReject = null;
    watchdog = null;
    constructor(port, options, update) {
        this.port = port;
        this.update = update;
        this.meta = { humanSide: options.humanSide, ownerSide: 'SOVIET', paused: false, manual: false, reason: null, accepted: 0, rejected: 0 };
        this.port.onmessage = e => { if (this.dead || this.faulted || e.data.epoch !== this.epoch)
            return; perf006.measure('clientReceive', () => this.receiveLocal(e.data)); };
        this.port.onerror = () => this.fail('WORKER_ERROR');
    }
    start(options) { if (this.started || this.dead)
        return Promise.reject(new Error('Already started')); this.started = true; return new Promise((resolve, reject) => { this.bootResolve = resolve; this.bootReject = reject; this.arm(); this.port.postMessage({ kind: 'START', epoch: this.epoch, options }); }); }
    subscribe(cb) { this.callbacks.add(cb); return () => { this.callbacks.delete(cb); }; }
    receiveLocal(reply) {
        if (this.dead || this.faulted || reply.epoch !== this.epoch)
            return;
        if (this.watchdog !== null)
            clearTimeout(this.watchdog);
        this.watchdog = null;
        if (reply.perf) {
            perf006.record('workerToMain', Math.max(0, performance.timeOrigin + performance.now() - reply.perf.sentAt));
            for (const key of ['policyMs', 'thinkMs', 'snapshotMs'])
                perf006.record(key, reply.perf[key]);
        }
        this.meta = reply.meta;
        const m = reply.message;
        if (m?.messageType === 'PLAYER_VIEW_SNAPSHOT') {
            this.state.snapshot = m.payload;
            this.state.view = m.payload.view;
            this.state.controllerId = m.payload.model.viewerControllerId;
            this.state.connection = 'CONNECTED';
            this.state.synced = true;
            this.state.pending = false;
        }
        else if (m && ['MATCH_QUERY', 'ACTION_ACCEPTED', 'ACTION_REJECTED'].includes(m.messageType))
            this.state.pending = false;
        if (this.bootResolve && this.state.snapshot) {
            this.bootResolve();
            this.bootResolve = null;
            this.bootReject = null;
        }
        for (const cb of [...this.callbacks]) {
            if (!perf006.enabled) {
                cb(m);
                continue;
            }
            const start = performance.now(), viewBefore = perf006.total('viewUpdate');
            perf006.measure('sessionApplyInclusive', () => cb(m));
            perf006.record('sessionApplyOutsideView', Math.max(0, performance.now() - start - (perf006.total('viewUpdate') - viewBefore)));
        }
        if (reply.takeover) {
            this.takeoverResolve?.();
            this.takeoverResolve = null;
            this.takeoverReject = null;
        }
        this.update();
        if (!this.meta.paused && this.meta.ownerSide !== this.meta.humanSide && !this.meta.manual && this.state.snapshot?.status === 'ACTIVE')
            this.arm();
    }
    send(type, payload) {
        if (this.dead || !this.canMutate || !['SUBMIT_ACTION', 'QUERY_MATCH'].includes(type))
            return null;
        const requestId = crypto.randomUUID();
        this.state.pending = true;
        this.arm();
        this.port.postMessage({ kind: 'REQUEST', epoch: this.epoch, requestId, type, payload });
        return requestId;
    }
    resyncMatch(matchId) { if (this.dead)
        return; this.arm(); this.port.postMessage({ kind: 'REQUEST', epoch: this.epoch, requestId: crypto.randomUUID(), type: 'RESYNC_MATCH', payload: { matchId } }); }
    takeover() {
        if (this.dead || (!this.meta.manual && !/^(AGENT_STOP|AGENT_ERROR|REJECTION_LIMIT)/.test(this.meta.reason ?? '')))
            return Promise.reject(new Error('Takeover unavailable'));
        return new Promise((resolve, reject) => { this.takeoverResolve = resolve; this.takeoverReject = reject; this.state.pending = true; this.arm(); this.port.postMessage({ kind: 'TAKEOVER', epoch: this.epoch, requestId: crypto.randomUUID() }); });
    }
    arm() { if (this.watchdog !== null)
        clearTimeout(this.watchdog); this.watchdog = setTimeout(() => this.fail('WORKER_TIMEOUT'), 30000); }
    fail(reason) { if (this.dead || this.faulted)
        return; this.faulted = true; this.port.terminate(); if (this.watchdog !== null)
        clearTimeout(this.watchdog); this.watchdog = null; this.meta = { ...this.meta, paused: true, reason }; this.state.pending = false; this.state.synced = false; this.bootReject?.(new Error(reason)); this.bootReject = null; this.bootResolve = null; this.takeoverReject?.(new Error(reason)); this.takeoverReject = null; this.takeoverResolve = null; for (const cb of this.callbacks)
        cb(null); this.update(); }
    dispose() { if (this.dead)
        return; this.dead = true; this.epoch++; if (this.watchdog !== null)
        clearTimeout(this.watchdog); this.port.onmessage = null; this.port.onerror = null; this.port.terminate(); this.callbacks.clear(); this.bootReject?.(new Error('CANCELLED')); this.takeoverReject?.(new Error('CANCELLED')); this.takeoverReject = null; this.takeoverResolve = null; this.bootResolve = null; this.bootReject = null; }
}
export function createLocalAiWorker() { return new Worker(new URL('../../ai/local/worker.js', import.meta.url), { type: 'module' }); }
