import { t } from '../localization/index.js';
// Replaced at build time. No extra network request is needed on a failing device.
export const STARTUP_BUILD = '2d094cfa10ea0c49b17fcd0d2a8a50329d340b82';
let active = 0, peak = 0, completed = 0, failed = 0;
const recent = [];
export function beginTerrainDiagnostic() { active++; peak = Math.max(peak, active); }
export function finishTerrainDiagnostic(record) {
    active--;
    if (record.outcome === 'ok')
        completed++;
    else
        failed++;
    // Paths from the manifest only; never export URL query strings, game DTOs or errors' raw messages.
    recent.push({ ...record, file: record.file.split(/[?#]/)[0], attempts: record.attempts.map(a => ({ ...a })) });
    if (recent.length > 12)
        recent.shift();
}
export function startupDiagnosticReport() {
    return { version: 'STARTUP-002', build: STARTUP_BUILD, userAgent: globalThis.navigator?.userAgent ?? '',
        online: globalThis.navigator?.onLine ?? null, visibility: globalThis.document?.visibilityState ?? null,
        imageJobs: { active, peak, completed, failed }, recent: recent.map(r => ({ ...r, attempts: r.attempts.map(a => ({ ...a })) })),
        boundaries: ['online is a browser hint, not proof of resource reachability',
            'imageJobs tracks loader jobs, not browser network connections',
            'abortRequested does not prove the network stack cancelled the transfer',
            'image events include transfer and decode; fetch headers/body and decoder attempts are recorded separately',
            'no room, token, full URL, game state or private device storage is exported'] };
}
function escape(text) { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
export function startupDiagnosticMarkup() {
    return `<details><summary>${t('startup.diagnostics')}</summary><p>${t('startup.diagnosticsHelp')}</p><textarea id="startup-diagnostic-text" readonly aria-label="${t('startup.diagnostics')}" rows="10" style="width:100%;box-sizing:border-box">${escape(JSON.stringify(startupDiagnosticReport(), null, 2))}</textarea><button id="startup-diagnostic-copy" type="button">${t('startup.copyDiagnostics')}</button><span id="startup-diagnostic-status" role="status"></span></details>`;
}
export function bindStartupDiagnostics(root) {
    root.querySelector('#startup-diagnostic-copy')?.addEventListener('click', async () => {
        const box = root.querySelector('#startup-diagnostic-text');
        const status = root.querySelector('#startup-diagnostic-status');
        if (!box)
            return;
        box.focus();
        box.select();
        try {
            if (!navigator.clipboard?.writeText)
                throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(box.value);
            if (status)
                status.textContent = t('startup.diagnosticsCopied');
        }
        catch {
            if (status)
                status.textContent = t('startup.diagnosticsSelect');
        }
    });
}
