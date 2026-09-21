import { startupLoadingMarkup } from './startupView.js';
import { languageControl } from '../localization/languageControl.js';
import { t, enumLabel, formatMessage } from '../localization/index.js';
import { createLocalGameSession } from '../core-adapter/session.js';
export const WEB_PREVIEW_VERSION = '0.0.10';
export const WEB_PREVIEW_BUILD = 'UI-009R2D2';
export const TERRAIN_VISUAL_SEED = 17;
/** New games get fresh entropy; explicit seeds still support exact replay. */
export function createGameplaySeed() {
    const value = new Uint32Array(1);
    do {
        globalThis.crypto.getRandomValues(value);
    } while (value[0] === 0);
    return value[0];
}
export function responsiveProfile(width, height) {
    if (width < 700 || (width < 820 && height > width))
        return 'MOBILE_NARROW';
    if (width <= 1366 && width >= height)
        return 'IPAD_LANDSCAPE';
    return 'DESKTOP';
}
export function productionDeveloperUiAllowed(hostname, query) {
    const local = hostname === '127.0.0.1' || hostname === 'localhost';
    return local && new URLSearchParams(query).get('dev') === '1';
}
export function createFreshProductionSession(rawMap, seed = createGameplaySeed()) {
    return createLocalGameSession(rawMap, seed);
}
function esc(value) {
    return value.replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] ?? char));
}
export function loadingMarkup(progress) {
    return startupLoadingMarkup(progress);
}
export function homeMarkup(profile) {
    const narrow = profile === 'MOBILE_NARROW';
    return `<main class="preview-home" data-preview-state="home" data-responsive-profile="${profile}">
    <section class="preview-home-card">${languageControl()}
      <div class="preview-brand-mark" aria-hidden="true">E</div>
      <span class="preview-kicker">EASTFRONT · 东线突击</span>
      <h1>${t('game.title')}</h1>
      <p class="preview-home-copy">${t('game.description')}</p>
      ${narrow ? `<p class="mobile-advisory" role="note">${t('game.advisory')}</p>` : ''}
      <button id="new-game-button" class="preview-new-game" type="button">${t('game.newGame')}</button>
      <details class="preview-about"><summary>${t('game.controls')}</summary><p>${t('game.controlsHelp')}</p></details>
      <footer class="preview-home-version">${t('game.webPreview')} · v${WEB_PREVIEW_VERSION} · ${WEB_PREVIEW_BUILD}</footer>
    </section>
  </main>`;
}
export function fatalMarkup(message) {
    return `<main class="preview-state preview-fatal" data-preview-state="fatal"><div class="preview-state-card">${languageControl()}<span class="preview-kicker">EASTFRONT</span><h1>${t('game.unableToStart')}</h1><p>${esc(formatMessage(message))}</p><button id="reload-button" class="preview-new-game" type="button">${t('game.reload')}</button></div></main>`;
}
export function mobileAdvisoryMarkup(profile) {
    return profile === 'MOBILE_NARROW' ? `<div class="mobile-game-advisory" role="note">${t('game.advisory')}</div>` : '';
}
export function defaultMapViewport() { return { zoom: 1, panX: 0, panY: 0 }; }
export function clampZoom(value) { return Math.max(1, Math.min(2.5, Math.round(value * 100) / 100)); }
export function zoomViewport(view, delta) {
    const zoom = clampZoom(view.zoom + delta);
    return zoom === 1 ? { zoom, panX: 0, panY: 0 } : { ...view, zoom };
}
export function productionRuntimeAssetRefs(manifest) {
    if (!manifest || !Array.isArray(manifest.assets))
        throw new Error('Production terrain manifest is invalid.');
    return [...new Set(manifest.assets.flatMap((entry) => entry.companion ? [entry.file, entry.companion] : [entry.file]))].sort();
}
export function validateProductionRuntimeManifest(manifest) {
    const refs = productionRuntimeAssetRefs(manifest);
    if (refs.length !== 123)
        throw new Error(`Production terrain manifest expected 123 raster paths, got ${refs.length}.`);
    if (!refs.includes('city/small/S02.png'))
        throw new Error('Production terrain manifest is missing P5R1 S02.');
    return refs;
}
export async function loadProductionRuntimeManifest(url = './assets/terrain/p4r3/manifest.json') {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`Failed to load production terrain manifest: HTTP ${response.status}`);
    const manifest = await response.json();
    validateProductionRuntimeManifest(manifest);
    return manifest;
}
export function privacyHandoffMarkup(gate, combatSide = 'German') {
    if (gate === 'COMBAT_DECISION')
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card">${languageControl()}<span class="eyebrow">${t('privacy.combatTitle')}</span><h1>${t('privacy.combatDecision', { side: enumLabel(combatSide.toUpperCase()) })}</h1><p>${t('privacy.combatHelp')}</p><button id="privacy-confirm" class="primary-action" type="button">${t('privacy.continueAs', { side: enumLabel(combatSide.toUpperCase()).toUpperCase() })}</button></div></div>`;
    if (gate === 'PASS_TO_GERMAN')
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card">${languageControl()}<span class="eyebrow">${t('privacy.title')}</span><h1>${t('privacy.sovietLocked')}</h1><p>${t('privacy.passGerman')}</p><button id="privacy-confirm" class="primary-action" type="button">${t('privacy.beginGerman')}</button></div></div>`;
    if (gate === 'REVEAL_BOTH')
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card">${languageControl()}<span class="eyebrow">${t('privacy.deploymentComplete')}</span><h1>${t('privacy.ready')}</h1><p>${t('privacy.reveal')}</p><button id="privacy-confirm" class="primary-action" type="button">${t('privacy.beginTurnOne')}</button></div></div>`;
    const side = gate === 'PASS_TURN_TO_GERMAN' ? 'German' : 'Soviet';
    return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card">${languageControl()}<span class="eyebrow">${t('privacy.turnTitle')}</span><h1>${t('privacy.passTurn', { side: enumLabel(side.toUpperCase()) })}</h1><p>${t('privacy.turnHelp')}</p><button id="privacy-confirm" class="primary-action" type="button">${t('privacy.beginTurn', { side: enumLabel(side.toUpperCase()).toUpperCase() })}</button></div></div>`;
}
export function gameOverMarkup(winner, reason, turn) {
    return `<div class="game-over-panel" data-preview-state="game-over"><div class="game-over-card">${languageControl()}<span class="eyebrow">${t('game.over')}</span><h1>${esc(winner ? enumLabel(winner) : t('game.noWinner'))}</h1><p>${esc(reason ? enumLabel(reason) : t('game.noVictoryReason'))}</p><p>${t('game.turn', { turn })}</p><span class="phase-pill">${t('game.finished')}</span><button id="new-game-button" class="primary-action game-over-restart" type="button">${t('game.newGame')}</button></div></div>`;
}
