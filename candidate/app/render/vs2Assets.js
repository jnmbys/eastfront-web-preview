import manifestData from '../assets/VS2_ASSET_MANIFEST.json' with { type: 'json' };
export const VS2_ASSET_ROOT = './assets/terrain/vs2-002';
export const vs2AssetManifest = manifestData;
const byId = new Map(vs2AssetManifest.assets.map(entry => [entry.id, entry]));
const byFamily = new Map();
for (const entry of vs2AssetManifest.assets) {
    const family = byFamily.get(entry.family) ?? [];
    family.push(entry);
    byFamily.set(entry.family, family);
}
export function vs2AssetUrl(entry) {
    // Keep manifest paths intact: they already include the assets/ prefix.
    return `${VS2_ASSET_ROOT}/${entry.file}`;
}
export const vs2AssetCatalog = {
    manifest: vs2AssetManifest,
    byId: id => byId.get(id),
    byFamily: family => byFamily.get(family) ?? [],
    url: vs2AssetUrl,
};
