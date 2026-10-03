import { loadTerrainImage, terrainImageLoadPolicy, terrainSurfaceCapabilities, type LoadedTerrainImage } from './terrainSurface.js';
import { checkTerrainAbort, type TerrainWorkControl } from './terrainWork.js';
import type { VS2AssetCatalog } from './vs2Assets.js';

/** Rollback is local to this page. No storage, quality, timeout or readiness changes. */
export function terrainImagePipelineEnabled(): boolean {
  return new URLSearchParams(globalThis.location?.search ?? '').get('terrainLoad') !== 'serial';
}

export function vs2ImageLoader(assets: VS2AssetCatalog, signal?: AbortSignal) {
  const capabilities = terrainSurfaceCapabilities(), policy = terrainImageLoadPolicy();
  return (id: string, cancellation = signal) => {
    const entry = assets.byId(id);
    if (!entry) throw new Error(`VS2 material missing from manifest: ${id}`);
    return loadTerrainImage({ id, family: entry.family, file: entry.file,
      sourceSize: [entry.sourceSize[0]!, entry.sourceSize[1]!] }, 'p5', capabilities,
      new URL(assets.url(entry), document.baseURI).href, policy, cancellation);
  };
}

/** At most two jobs, including completed-but-not-consumed images. A slow head
 * cannot accumulate an unbounded decoded tail. Consumption is always ordered. */
export async function consumeTerrainImages(
  ids: readonly string[], load: (id: string, signal: AbortSignal) => Promise<LoadedTerrainImage>,
  consume: (id: string, image: LoadedTerrainImage) => void, control?: TerrainWorkControl,
  window = terrainImagePipelineEnabled() && !terrainImageLoadPolicy().webkitFallback ? 2 : 1,
): Promise<void> {
  const controller = new AbortController(), pending = new Map<number, Promise<void>>();
  const ready = new Map<number, LoadedTerrainImage>(), failures = new Map<number, unknown>();
  const abort = () => controller.abort(control?.signal?.reason);
  control?.signal?.addEventListener('abort', abort, { once: true });
  if (control?.signal?.aborted) abort();
  const limit = Math.max(1, Math.min(2, Math.floor(window) || 1));
  let next = 0;
  const fill = () => {
    while (next < ids.length && pending.size < limit && !controller.signal.aborted) {
      const index = next++;
      const task = Promise.resolve().then(() => {
        checkTerrainAbort(controller.signal);
        return load(ids[index]!, controller.signal);
      }).then(image => {
        if (controller.signal.aborted) image.release?.();
        else ready.set(index, image);
      }, error => { failures.set(index, error); });
      pending.set(index, task);
    }
  };
  try {
    await control?.checkpoint(); checkTerrainAbort(controller.signal); fill();
    for (let index = 0; index < ids.length; index++) {
      await pending.get(index);
      await control?.checkpoint(); checkTerrainAbort(controller.signal);
      if (failures.has(index)) throw failures.get(index);
      const image = ready.get(index)!;
      try { consume(ids[index]!, image); }
      finally { ready.delete(index); image.release?.(); }
      pending.delete(index); fill();
    }
  } finally {
    controller.abort();
    control?.signal?.removeEventListener('abort', abort);
    for (const image of ready.values()) image.release?.();
    ready.clear();
    // Late completions release themselves; errors already have handlers.
    await Promise.all(pending.values());
  }
}

/** Infrastructure is consumed serially. Three LRU slots reuse river/bridge
 * materials within this paint only, with eviction before loading a new image. */
export class TerrainImageReuse {
  private readonly images = new Map<string, LoadedTerrainImage>();
  constructor(private readonly load: (id: string) => Promise<LoadedTerrainImage>) {}
  async get(id: string): Promise<LoadedTerrainImage> {
    const existing = this.images.get(id);
    if (existing) { this.images.delete(id); this.images.set(id, existing); return existing; }
    if (this.images.size === 3) {
      const oldest = this.images.keys().next().value!;
      this.images.get(oldest)!.release?.(); this.images.delete(oldest);
    }
    const image = await this.load(id); this.images.set(id, image); return image;
  }
  dispose(): void { for (const image of this.images.values()) image.release?.(); this.images.clear(); }
}
