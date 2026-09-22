import { isNetworkAction, isQueryDraft, shape, id, revision } from './gameplayProtocol.js';
export const PROTOCOL_VERSION = 2;
export const SEATS = ['GERMANY', 'SOVIET'];
export const sideForSeat = (seat) => seat === 'GERMANY' ? 'GERMAN' : 'SOVIET';
export function serverMessage(messageType, payload, requestId = null) {
    return { protocolVersion: PROTOCOL_VERSION, messageType, payload, requestId };
}
export function clientMessage(messageType, payload, requestId) {
    return { protocolVersion: PROTOCOL_VERSION, messageType, payload, requestId };
}
const object = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v, keys) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
/** Exact allowlist validation; arbitrary extra authority/view/state fields are rejected. */
export function parseClientMessage(text) {
    let v;
    try {
        v = JSON.parse(text);
    }
    catch {
        return { ok: false, code: 'BAD_MESSAGE', requestId: null };
    }
    const requestId = object(v) && typeof v.requestId === 'string' && /^[\w-]{1,64}$/.test(v.requestId) ? v.requestId : null;
    const fail = (code) => ({ ok: false, code, requestId });
    if (!object(v) || !requestId || !exact(v, ['protocolVersion', 'messageType', 'requestId', 'payload']))
        return fail('BAD_MESSAGE');
    if (v.protocolVersion !== PROTOCOL_VERSION)
        return fail('VERSION_MISMATCH');
    if (!object(v.payload))
        return fail('BAD_MESSAGE');
    const p = v.payload;
    let valid = false;
    switch (v.messageType) {
        case 'SUBMIT_ACTION':
            valid = shape(p, { matchId: id, expectedRevision: revision, action: isNetworkAction });
            break;
        case 'QUERY_MATCH':
            valid = shape(p, { matchId: id, expectedRevision: revision, draft: isQueryDraft });
            break;
        case 'RESYNC_MATCH':
            valid = shape(p, { matchId: id });
            break;
        case 'HELLO':
            valid = exact(p, ['displayName']) && typeof p.displayName === 'string' && p.displayName.trim().length > 0 && p.displayName.length <= 32 && !/[\u0000-\u001f\u007f]/.test(p.displayName);
            break;
        case 'RECONNECT':
            valid = exact(p, ['reconnectToken']) && typeof p.reconnectToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(p.reconnectToken);
            break;
        case 'CREATE_ROOM':
        case 'LEAVE_ROOM':
            valid = exact(p, []);
            break;
        case 'JOIN_ROOM':
            valid = exact(p, ['roomCode']) && typeof p.roomCode === 'string' && /^[a-zA-Z2-9]{6}$/.test(p.roomCode.trim());
            break;
        case 'SELECT_SEAT':
            valid = exact(p, ['seat']) && SEATS.includes(p.seat);
            break;
        case 'SET_READY':
            valid = exact(p, ['ready']) && typeof p.ready === 'boolean';
            break;
        default: return fail('UNSUPPORTED_MESSAGE');
    }
    return valid ? { ok: true, message: v } : fail('BAD_MESSAGE');
}
