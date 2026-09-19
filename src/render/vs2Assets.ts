import manifestData from '../assets/VS2_ASSET_MANIFEST.json' with { type: 'json' };

// Derive the contract from the unmodified Painter manifest, including its
// rotationAllowed degrees/mode variants, mirrorAllowed, and uppercase LOD.
type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;
export type VS2AssetManifest = DeepReadonly<typeof manifestData>;
export type VS2AssetEntry = VS2AssetManifest['assets'][number];
export type VS2RotationAllowed = VS2AssetEntry['rotationAllowed'];
export type VS2MirrorAllowed = VS2AssetEntry['mirrorAllowed'];

export const VS2_ASSET_ROOT = './assets/terrain/vs2-002';
export const vs2AssetManifest: VS2AssetManifest = manifestData;
export interface VS2AssetCatalog {
  readonly manifest: VS2AssetManifest;
  byId(id: string): VS2AssetEntry | undefined;
  byFamily(family: string): readonly VS2AssetEntry[];
  url(entry: VS2AssetEntry): string;
}

const byId = new Map(vs2AssetManifest.assets.map(entry => [entry.id, entry]));
const byFamily = new Map<string, VS2AssetEntry[]>();
for (const entry of vs2AssetManifest.assets) {
  const family = byFamily.get(entry.family) ?? [];
  family.push(entry);
  byFamily.set(entry.family, family);
}

export function vs2AssetUrl(entry: VS2AssetEntry): string {
  // Keep manifest paths intact: they already include the assets/ prefix.
  return `${VS2_ASSET_ROOT}/${entry.file}`;
}

export const vs2AssetCatalog: VS2AssetCatalog = {
  manifest: vs2AssetManifest,
  byId: id => byId.get(id),
  byFamily: family => byFamily.get(family) ?? [],
  url: vs2AssetUrl,
};
