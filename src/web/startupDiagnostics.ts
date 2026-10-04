import { t } from '../localization/index.js';
import {terrainBuildDiagnosticReport} from '../render/terrainBuildDiagnostics.js';

// Replaced at build time. No extra network request is needed on a failing device.
export const STARTUP_BUILD = '__EASTFRONT_SOURCE_COMMIT__';
export interface TerrainAttempt {
  path: 'image' | 'fetch' | 'bitmap' | 'blob-image';
  elapsedMs: number;
  outcome: 'ok' | 'failed';
  stage?: string;
  transferStage?: string;
  errorName?: string;
  httpStatus?: number;
  contentType?: string;
  bytes?: number;
  abortRequested?: boolean;
  imageComplete?: boolean;
  width?: number;
  height?: number;
}
interface TerrainLoadRecord {
  asset: string;
  file: string;
  webkitFallback: boolean;
  timeoutMs: number;
  elapsedMs: number;
  outcome: 'ok' | 'failed';
  attempts: TerrainAttempt[];
}
let active = 0, peak = 0, completed = 0, failed = 0;
const recent: TerrainLoadRecord[] = [];
export function beginTerrainDiagnostic() { active++; peak = Math.max(peak, active); }
export function finishTerrainDiagnostic(record: TerrainLoadRecord) {
  active--; if (record.outcome === 'ok') completed++; else failed++;
  // Paths from the manifest only; never export URL query strings, game DTOs or errors' raw messages.
  recent.push({...record, file: record.file.split(/[?#]/)[0]!, attempts: record.attempts.map(a => ({...a}))});
  if (recent.length > 12) recent.shift();
}
export function startupDiagnosticReport() {
  return {version: 'STARTUP-002', build: STARTUP_BUILD, userAgent: globalThis.navigator?.userAgent ?? '',
    online: globalThis.navigator?.onLine ?? null, visibility: globalThis.document?.visibilityState ?? null,
    imageJobs: {active, peak, completed, failed}, recent: recent.map(r => ({...r, attempts: r.attempts.map(a => ({...a}))})),
    terrainBuild:terrainBuildDiagnosticReport(),
    boundaries: ['online is a browser hint, not proof of resource reachability',
      'imageJobs tracks loader jobs, not browser network connections',
      'abortRequested does not prove the network stack cancelled the transfer',
      'image events include transfer and decode; fetch headers/body and decoder attempts are recorded separately',
      'no room, token, full URL, game state or private device storage is exported']};
}
function escape(text: string) { return text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
export function startupDiagnosticMarkup() {
  return `<details><summary>${t('startup.diagnostics')}</summary><p>${t('startup.diagnosticsHelp')}</p><textarea id="startup-diagnostic-text" readonly aria-label="${t('startup.diagnostics')}" rows="10" style="width:100%;box-sizing:border-box">${escape(JSON.stringify(startupDiagnosticReport(), null, 2))}</textarea><button id="startup-diagnostic-copy" type="button">${t('startup.copyDiagnostics')}</button><span id="startup-diagnostic-status" role="status"></span></details>`;
}
export function bindStartupDiagnostics(root: HTMLElement) {
  // Opt-in on a running map: export a fresh snapshot during unfinished detail
  // work. No polling timer or network collector is added to normal gameplay.
  if(new URLSearchParams(globalThis.location?.search??'').get('startupDiag')==='1'&&!root.querySelector('#startup-diagnostic-text')){
    const label=root.querySelector('#terrain-detail-status');
    if(label){const panel=document.createElement('div');panel.style.cssText='position:fixed;right:12px;bottom:12px;z-index:50;width:min(420px,calc(100vw - 24px));max-height:70vh;overflow:auto;box-sizing:border-box;background:#1b2122;color:#d7dedb;padding:10px;border:1px solid #596362';panel.innerHTML=startupDiagnosticMarkup();root.append(panel);}
  }
  const diagnosticBox=root.querySelector('#startup-diagnostic-text');
  if(diagnosticBox&&!root.querySelector('#startup-diagnostic-save')&&new URLSearchParams(globalThis.location?.search??'').get('startupDiag')==='1'){
    const button=document.createElement('button');button.id='startup-diagnostic-save';button.type='button';button.textContent=t('startup.diagnostics')+' JSON ↓';diagnosticBox.parentElement?.append(button);
    button.addEventListener('click',()=>{
      const data=JSON.stringify(startupDiagnosticReport(),null,2)+'\n';(diagnosticBox as HTMLTextAreaElement).value=data;
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download=`startup005-${Date.now()}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  root.querySelector('#startup-diagnostic-copy')?.addEventListener('click', async () => {
    const box = root.querySelector<HTMLTextAreaElement>('#startup-diagnostic-text');
    const status = root.querySelector('#startup-diagnostic-status');
    if (!box) return;
    box.focus(); box.select();
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(box.value); if (status) status.textContent = t('startup.diagnosticsCopied'); }
    catch { if (status) status.textContent = t('startup.diagnosticsSelect'); }
  });
}
