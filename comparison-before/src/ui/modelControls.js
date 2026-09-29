import { t } from '../localization/index.js';
import { saveModelDisplay } from '../presentation/modelDisplay.js';
export function modelControls(runtime) {
    return `<label class="model-controls" for="unit-models">${t('models.label')} <select id="unit-models">${['auto', 'off'].map(mode => `<option value="${mode}" ${runtime.modelDisplay === mode ? 'selected' : ''}>${t(`models.${mode}`)}</option>`).join('')}</select></label>`;
}
export function bindModelControls(root, runtime) {
    root.querySelector('#unit-models')?.addEventListener('change', event => { const mode = event.currentTarget.value; if (mode !== 'auto' && mode !== 'off')
        return; runtime.setModelDisplay(mode); saveModelDisplay(mode); });
}
