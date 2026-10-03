import { createDemoAdapter } from './demo-adapter.mjs';
import { render } from './view.mjs';
const adapter = createDemoAdapter();
adapter.subscribe(state => render(state, command => adapter.command(command)));
document.getElementById('response').addEventListener('change', event => adapter.configure('response', event.target.value));
document.getElementById('handoff-fault').addEventListener('change', event => adapter.configure('handoffFault', event.target.value));
document.getElementById('reset').addEventListener('click', () => adapter.reset());
