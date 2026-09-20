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
export function loadingMarkup() {
    return `<main class="preview-state preview-loading" data-preview-state="loading"><div class="preview-state-card"><span class="preview-kicker">EASTFRONT</span><h1>Loading EASTFRONT…</h1><p>Preparing Strategic Reset F and production assets.</p></div></main>`;
}
export function homeMarkup(profile) {
    const narrow = profile === 'MOBILE_NARROW';
    return `<main class="preview-home" data-preview-state="home" data-responsive-profile="${profile}">
    <section class="preview-home-card">
      <div class="preview-brand-mark" aria-hidden="true">E</div>
      <span class="preview-kicker">EASTFRONT · 东线突击</span>
      <h1>Operational Hex Wargame</h1>
      <p class="preview-home-copy">A hot-seat operational campaign on the Strategic Reset F 20×32 map.</p>
      ${narrow ? '<p class="mobile-advisory" role="note">For the best experience, use landscape or a larger screen.</p>' : ''}
      <button id="new-game-button" class="preview-new-game" type="button">NEW GAME</button>
      <details class="preview-about"><summary>About / Controls</summary><p>Tap counters and highlighted Hexes to act. Drag the map to pan; use + / − to zoom. Hidden deployment uses pass-device privacy handoffs.</p></details>
      <footer class="preview-home-version">EASTFRONT Web Preview · v${WEB_PREVIEW_VERSION} · ${WEB_PREVIEW_BUILD}</footer>
    </section>
  </main>`;
}
export function fatalMarkup(message) {
    return `<main class="preview-state preview-fatal" data-preview-state="fatal"><div class="preview-state-card"><span class="preview-kicker">EASTFRONT</span><h1>Unable to start EASTFRONT</h1><p>${esc(message)}</p><button id="reload-button" class="preview-new-game" type="button">RELOAD</button></div></main>`;
}
export function mobileAdvisoryMarkup(profile) {
    return profile === 'MOBILE_NARROW' ? '<div class="mobile-game-advisory" role="note">For the best experience, use landscape or a larger screen.</div>' : '';
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
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card"><span class="eyebrow">COMBAT DECISION HANDOFF</span><h1>${combatSide} Side decision required.</h1><p>Pass device, then continue. GameState is not changed by this gate.</p><button id="privacy-confirm" class="primary-action" type="button">CONTINUE AS ${combatSide.toUpperCase()}</button></div></div>`;
    if (gate === 'PASS_TO_GERMAN')
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card"><span class="eyebrow">HOT-SEAT PRIVACY</span><h1>Soviet deployment locked.</h1><p>Pass the device to the German player.</p><button id="privacy-confirm" class="primary-action" type="button">BEGIN GERMAN DEPLOYMENT</button></div></div>`;
    if (gate === 'REVEAL_BOTH')
        return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card"><span class="eyebrow">DEPLOYMENT COMPLETE</span><h1>Both sides are ready.</h1><p>The full board will now be revealed for German Turn 1.</p><button id="privacy-confirm" class="primary-action" type="button">BEGIN TURN 1</button></div></div>`;
    const side = gate === 'PASS_TURN_TO_GERMAN' ? 'German' : 'Soviet';
    return `<div class="privacy-gate" data-preview-state="privacy-handoff"><div class="privacy-card"><span class="eyebrow">PLAYER TURN HANDOFF</span><h1>Pass device to ${side} side.</h1><p>The authoritative GameState is unchanged by this presentation gate.</p><button id="privacy-confirm" class="primary-action" type="button">BEGIN ${side.toUpperCase()} PLAYER TURN</button></div></div>`;
}
export function gameOverMarkup(winner, reason, turn) {
    return `<div class="game-over-panel" data-preview-state="game-over"><div class="game-over-card"><span class="eyebrow">GAME OVER</span><h1>${esc(winner ?? 'No Winner')}</h1><p>${esc(reason ?? 'No victory reason supplied by Core.')}</p><p>Turn ${turn}</p><span class="phase-pill">Authoritative Core victory state · no further actions</span><button id="new-game-button" class="primary-action game-over-restart" type="button">NEW GAME</button></div></div>`;
}
