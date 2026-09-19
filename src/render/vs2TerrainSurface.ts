import { vs2AssetCatalog, type VS2AssetCatalog, type VS2AssetEntry } from './vs2Assets.js';

export interface VS2TerrainAssetReference {
  readonly entry: VS2AssetEntry;
  readonly url: string;
}

/** Checkpoint A integration contract only; no surface is generated or drawn. */
export interface VS2TerrainSurfaceHooks {
  readonly stage: 'asset-integration-only';
  readonly renderAvailable: false;
  readonly assets: VS2AssetCatalog;
  lookupAsset(id: string): VS2TerrainAssetReference | undefined;
}

export function createVS2TerrainSurfaceHooks(
  assets: VS2AssetCatalog = vs2AssetCatalog,
): VS2TerrainSurfaceHooks {
  return {
    stage: 'asset-integration-only',
    renderAvailable: false,
    assets,
    lookupAsset(id) {
      const entry = assets.byId(id);
      return entry ? { entry, url: assets.url(entry) } : undefined;
    },
  };
}
