const observers = new Set();
export function observeTerrainLoad(observer) {
    observers.add(observer);
    return () => { observers.delete(observer); };
}
export function reportTerrainLoad(event) {
    for (const observer of observers) {
        try {
            observer(event);
        }
        catch { /* Presentation cannot fail a resource load. */ }
    }
}
export function reportLoadedTerrainImage(image) {
    reportTerrainLoad({ kind: 'asset-complete' });
    return image;
}
