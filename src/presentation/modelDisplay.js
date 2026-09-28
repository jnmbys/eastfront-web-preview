const key = 'eastfront.unitModels';
export function readModelDisplay() { try {
    return globalThis.localStorage?.getItem(key) === 'off' ? 'off' : 'auto';
}
catch {
    return 'auto';
} }
export function saveModelDisplay(mode) { try {
    globalThis.localStorage?.setItem(key, mode);
}
catch { /* Private browsing keeps the in-memory preference. */ } }
