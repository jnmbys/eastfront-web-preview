import { bindLanguageControl, languageControl } from '../localization/languageControl.js';
import { LobbyClient } from './client.js';
import { loadMultiplayerUrl } from './config.js';
import { mt } from './catalog.js';
import { SEATS } from './protocol.js';
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function addMultiplayerHomeButton(root, onOpen) {
    if (!document.querySelector('link[data-multiplayer-style]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = './multiplayer.css';
        link.dataset.multiplayerStyle = 'true';
        document.head.append(link);
    }
    const anchor = root.querySelector('#new-game-button');
    if (!anchor)
        return;
    anchor.insertAdjacentHTML('afterend', `<button id="multiplayer-button" class="secondary-action mp-home-button" type="button">${mt('title')}</button>`);
    root.querySelector('#multiplayer-button')?.addEventListener('click', onOpen);
}
/** Scoped lobby mount. Network events cannot call the battle render function. */
export function mountLobby(root, onBack, onMatch) {
    let client = null, disposed = false, loading = true, url = '', name = '', code = '', notice = null, leaving = false;
    try {
        name = sessionStorage.getItem('eastfront.mp.name') ?? '';
    }
    catch { }
    const draw = () => {
        if (disposed)
            return;
        if (onMatch && client?.state.snapshot) {
            disposed = true;
            window.removeEventListener('pagehide', pagehide);
            onMatch(client);
            return;
        }
        const state = client?.state, room = state?.room, online = client?.canMutate === true;
        if (leaving && online && !room) {
            dispose();
            onBack();
            return;
        }
        const connection = state?.connection ?? 'DISCONNECTED';
        const connectionLabel = connection === 'CONNECTED' ? 'connected' : connection === 'CONNECTING' ? 'connecting' : connection === 'RECONNECTING' ? 'reconnecting' : 'disconnected';
        const mine = room && state?.controllerId ? SEATS.find(seat => room.seats[seat].controllerId === state.controllerId) : undefined, ready = mine ? room.seats[mine].ready : false;
        root.innerHTML = `<main class="mp-shell" data-preview-state="multiplayer"><section class="mp-lobby">
      <header class="mp-header"><div><span class="preview-kicker">EASTFRONT</span><h1>${mt('title')}</h1></div>${languageControl()}</header>
      <p class="mp-status ${connection === 'CONNECTED' ? 'mp-online' : 'mp-offline'}" role="status">${loading ? mt('connecting') : mt(connectionLabel)}${state?.pending ? ` · ${mt('pending')}` : ''}</p>
      ${state?.error || notice ? `<p class="mp-notice" role="alert">${mt(state?.error ?? notice)}</p>` : ''}
      ${room ? `<div class="mp-code-row"><div><span>${mt('code')}</span><strong id="mp-room-code" tabindex="0">${esc(room.roomCode)}</strong></div><button id="mp-copy" class="secondary-action">${mt('copy')}</button></div>
      <p class="mp-help">${mt(room.status === 'LOBBY' ? 'select' : room.status === 'STARTING' ? 'starting' : 'created')}</p>
      <div class="mp-seats">${SEATS.map(seat => {
            const occupied = room.seats[seat], owner = room.clients.find(p => p.controllerId === occupied.controllerId), self = owner?.controllerId === state?.controllerId;
            return `<article class="mp-seat ${self ? 'mp-mine' : ''} ${occupied.ready ? 'mp-ready' : ''}" data-seat="${seat}"><span class="mp-seat-mark" aria-hidden="true">${seat === 'GERMANY' ? '◆' : '★'}</span>
          <h2>${mt(seat === 'GERMANY' ? 'germany' : 'soviet')}</h2><p class="mp-player">${owner ? esc(owner.displayName) : mt('empty')}${self ? ` · ${mt('you')}` : ''}</p>
          <p class="mp-seat-connection">${owner ? mt(owner.connected ? 'connected' : 'disconnected') : mt('waiting')}</p>
          <strong class="mp-ready-label">${mt(occupied.ready ? 'ready' : 'notReady')}</strong>
          <button data-mp-seat="${seat}" class="secondary-action" ${!online || room.status !== 'LOBBY' || (occupied.controllerId !== null && !self) || self ? 'disabled' : ''}>${mt(seat === 'GERMANY' ? 'chooseGermany' : 'chooseSoviet')}</button></article>`;
        }).join('')}</div>
      ${room.status === 'IN_GAME' ? `<div class="mp-match" role="status"><h2>${mt('created')}</h2><p>${mt(state?.view ? 'snapshot' : 'activeReconnect')}</p>${state?.match ? `<small>${mt('match')} · ${esc(state.match.matchId)}</small>` : ''}</div>` :
            `<button id="mp-ready" class="primary-action mp-ready-button" ${!online || !mine || room.status !== 'LOBBY' ? 'disabled' : ''}>${ready ? mt('unready') : mt('prepare')}</button>${ready ? `<p class="mp-help">${mt('waiting')}</p>` : ''}`}
      <div class="mp-footer"><button id="mp-back" class="secondary-action">${mt('back')}</button>${connection === 'DISCONNECTED' ? `<button id="mp-reconnect" class="secondary-action">${mt('reconnect')}</button>` : ''}<button id="mp-leave" class="secondary-action" ${!online ? 'disabled' : ''}>${mt('leave')}</button></div>` :
            `<p class="mp-help">${mt('intro')}</p><label class="mp-field">${mt('name')}<input id="mp-name" maxlength="32" autocomplete="nickname" ${connection === 'CONNECTED' ? 'disabled' : ''} value="${esc(name)}"></label>
      ${connection === 'CONNECTED' ? `<div class="mp-create"><button id="mp-create" class="primary-action" ${!online ? 'disabled' : ''}>${mt('create')}</button></div>
      <form id="mp-join-form" class="mp-join"><label class="mp-field">${mt('code')}<input id="mp-code" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" value="${esc(code)}" required pattern="[a-zA-Z2-9]{6}"></label><button id="mp-join" class="secondary-action" ${!online ? 'disabled' : ''}>${mt('join')}</button></form>` :
                `<button id="mp-connect" class="primary-action" ${loading || !url || connection !== 'DISCONNECTED' ? 'disabled' : ''}>${mt('connect')}</button>`}
      <div class="mp-footer"><button id="mp-back" class="secondary-action">${mt('back')}</button></div>`}
      </section></main>`;
        bindLanguageControl(root, draw);
        const input = root.querySelector('#mp-name');
        input?.addEventListener('input', () => { name = input.value; });
        const codeInput = root.querySelector('#mp-code');
        codeInput?.addEventListener('input', () => { code = codeInput.value; });
        root.querySelector('#mp-connect')?.addEventListener('click', () => {
            if (!name.trim()) {
                input?.focus();
                return;
            }
            try {
                sessionStorage.setItem('eastfront.mp.name', name.trim());
            }
            catch { }
            client?.connect(name);
        });
        root.querySelector('#mp-reconnect')?.addEventListener('click', () => client?.connect(name));
        root.querySelector('#mp-create')?.addEventListener('click', () => client?.send('CREATE_ROOM', {}));
        root.querySelector('#mp-join-form')?.addEventListener('submit', event => { event.preventDefault(); client?.send('JOIN_ROOM', { roomCode: code.trim() }); });
        root.querySelectorAll('[data-mp-seat]').forEach(button => button.addEventListener('click', () => client?.send('SELECT_SEAT', { seat: button.dataset.mpSeat })));
        root.querySelector('#mp-ready')?.addEventListener('click', () => client?.send('SET_READY', { ready: !ready }));
        root.querySelector('#mp-leave')?.addEventListener('click', () => { leaving = true; client?.send('LEAVE_ROOM', {}); });
        root.querySelector('#mp-back')?.addEventListener('click', () => { dispose(); onBack(); });
        root.querySelector('#mp-copy')?.addEventListener('click', () => {
            const value = room?.roomCode;
            if (!value)
                return;
            void (async () => { try {
                await navigator.clipboard.writeText(value);
                notice = 'copied';
            }
            catch {
                notice = 'copyHelp';
            } draw(); })();
        });
    };
    const dispose = () => { disposed = true; client?.dispose(); window.removeEventListener('pagehide', pagehide); };
    const pagehide = () => client?.dispose();
    window.addEventListener('pagehide', pagehide);
    draw();
    void loadMultiplayerUrl().then(result => { if (disposed)
        return; url = result; loading = false; if (!url)
        notice = 'noService';
    else
        client = new LobbyClient(url, draw); draw(); }).catch(() => { if (!disposed) {
        loading = false;
        notice = 'invalidUrl';
        draw();
    } });
    return dispose;
}
