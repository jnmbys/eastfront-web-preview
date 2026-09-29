import { t } from '../localization/index.js';
import { languageControl } from '../localization/languageControl.js';
import { StartupProgress } from './startupProgress.js';
function copy(progress) {
    return {
        stage: t(`startup.${progress.stage}`),
        steps: progress.stage === 'ready' ? '100%' : t('startup.steps', { completed: progress.completedSteps, total: progress.totalSteps }),
        items: progress.stage === 'assets' && progress.batchTotal !== null
            ? t('startup.batch', { completed: progress.batchCompleted, total: progress.batchTotal })
            : progress.completedAssets ? t('startup.loaded', { completed: progress.completedAssets }) : t('game.preparing'),
    };
}
// The bar measures completed milestones. No invented overall percentage/ETA.
export function startupLoadingMarkup(progress = new StartupProgress().snapshot) {
    const text = copy(progress), ratio = progress.completedSteps / progress.totalSteps;
    return `<main class="preview-state preview-loading" data-preview-state="loading"><div class="preview-state-card">${languageControl()}<span class="preview-kicker">EASTFRONT</span><h1>${t('game.loading')}</h1><div class="startup-progress" data-startup-stage="${progress.stage}"><div class="startup-track" role="progressbar" aria-label="${t('startup.progress')}" aria-valuemin="0" aria-valuemax="${progress.totalSteps}" aria-valuenow="${progress.completedSteps}" aria-valuetext="${text.steps}"><span class="startup-fill" style="transform:scaleX(${ratio})"></span></div><div class="startup-steps">${text.steps}</div><p class="startup-stage" role="status" aria-live="polite">${text.stage}</p><p class="startup-items">${text.items}</p></div></div></main>`;
}
/** Patch only small text/transform nodes; keep the bar and language control alive. */
export function updateStartupLoading(root, progress) {
    const view = root.querySelector('.startup-progress');
    if (!view)
        return;
    const text = copy(progress);
    view.dataset.startupStage = progress.stage;
    const track = view.querySelector('.startup-track');
    track?.setAttribute('aria-valuenow', String(progress.completedSteps));
    track?.setAttribute('aria-valuetext', text.steps);
    const fill = view.querySelector('.startup-fill');
    if (fill)
        fill.style.transform = `scaleX(${progress.completedSteps / progress.totalSteps})`;
    for (const [selector, value] of [['.startup-steps', text.steps], ['.startup-stage', text.stage], ['.startup-items', text.items]]) {
        const element = view.querySelector(selector);
        if (element && element.textContent !== value)
            element.textContent = value;
    }
}
