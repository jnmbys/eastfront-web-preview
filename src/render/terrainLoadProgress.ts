/** Read-only notifications. Observers must never change resource/error semantics. */
export type TerrainLoadProgressEvent =
  | { readonly kind: 'assets'; readonly total: number | null }
  | { readonly kind: 'asset-complete' }
  | { readonly kind: 'building' };
const observers = new Set<(event: TerrainLoadProgressEvent) => void>();
export function observeTerrainLoad(observer: (event: TerrainLoadProgressEvent) => void): () => void {
  observers.add(observer);
  return () => { observers.delete(observer); };
}
export function reportTerrainLoad(event: TerrainLoadProgressEvent): void {
  for (const observer of observers) {
    try { observer(event); } catch { /* Presentation cannot fail a resource load. */ }
  }
}
export function reportLoadedTerrainImage<T>(image: T): T {
  reportTerrainLoad({ kind: 'asset-complete' });
  return image;
}
