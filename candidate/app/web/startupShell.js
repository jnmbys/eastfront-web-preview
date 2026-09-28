// Lightweight shell runs independently of the existing main module graph.
import { bindLanguageControl } from '../localization/languageControl.js';
import { startupProgress } from './startupProgress.js';
import { startupLoadingMarkup, updateStartupLoading } from './startupView.js';
const root = document.querySelector('#app');
if (root) {
    const repaint = () => {
        if (!root.querySelector('[data-preview-state="loading"]'))
            return;
        root.innerHTML = startupLoadingMarkup(startupProgress.snapshot);
        bindLanguageControl(root, repaint);
    };
    repaint();
    const unsubscribe = startupProgress.subscribe(snapshot => updateStartupLoading(root, snapshot));
    window.addEventListener('pagehide', unsubscribe, { once: true });
}
