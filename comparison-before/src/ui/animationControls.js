import { t } from '../localization/index.js';
export function animationControls(runtime) {
    return `<div class="animation-controls"><label for="animation-speed">${t('animation.speed')}</label><select id="animation-speed">${['normal', 'fast', 'instant'].map(speed => `<option value="${speed}" ${runtime.speed === speed ? 'selected' : ''}>${t(`animation.${speed}`)}</option>`).join('')}</select><button id="animation-skip" class="map-control-button" type="button">${t('animation.skip')}</button></div>`;
}
export function bindAnimationControls(root, runtime) {
    root.querySelector('#animation-speed')?.addEventListener('change', event => {
        const value = event.currentTarget.value;
        if (['normal', 'fast', 'instant'].includes(value))
            runtime.setSpeed(value);
    });
    root.querySelector('#animation-skip')?.addEventListener('click', () => runtime.skip());
}
