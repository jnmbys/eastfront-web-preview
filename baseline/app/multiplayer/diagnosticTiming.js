// Opt-in measurements only. Never pass a payload, token, unit or Action here.
export const transportTimingEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).get('transportDiagnostics') === '1';
export function publishReceiveTiming(timing) {
    if (transportTimingEnabled && typeof window !== 'undefined')
        window.dispatchEvent(new CustomEvent('eastfront-transport-timing', { detail: timing }));
}
