// Isolated preview only. Block sockets even if someone supplies a production URL.
if(['eastfront-web-preview.pages.dev','jnmbys.github.io'].includes(location.hostname))throw new Error('Preview harness is not permitted on the production hostname');
window.WebSocket=class{constructor(){throw new Error('Multiplayer is disabled in ART-PREVIEW-001');}};
performance.setResourceTimingBufferSize(2000);
