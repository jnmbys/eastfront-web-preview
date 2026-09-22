import manifestData from '../assets/p4r3-manifest.json' with { type: 'json' };
const entries = manifestData.assets;
const byIdMap = new Map(entries.map(e => [e.id, e]));
const byFamilyMap = new Map();
for (const e of entries) {
    const list = byFamilyMap.get(e.family) ?? [];
    list.push(e);
    byFamilyMap.set(e.family, list);
}
export function stableStringHash(value) { let h = 2166136261 >>> 0; for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
} return h >>> 0; }
export function visualSeed(seed, hex, kind) { return stableStringHash(`${seed}|${hex.q}|${hex.r}|${kind}`); }
export function unorderedEdgeVisualSeed(seed, a, b, kind) { const ka = `${a.q},${a.r}`, kb = `${b.q},${b.r}`; return stableStringHash(`${seed}|${ka < kb ? ka : kb}|${ka < kb ? kb : ka}|${kind}`); }
export const terrainAssetCatalog = { byId: (id) => byIdMap.get(id), byFamily: (f) => byFamilyMap.get(f) ?? [], selectVariant: (family, seed, hex, salt = '') => { const list = byFamilyMap.get(family) ?? []; return list.length ? list[visualSeed(seed, hex, `${family}|${salt}`) % list.length] : undefined; } };
export function assetRoot(set = 'p5') { return set === 'p4r3' ? './dev-assets/terrain/p4r3-baseline' : './assets/terrain/p4r3'; }
export function assetUrl(entry, set = 'p5') { return `${assetRoot(set)}/${entry.file}`; }
export function assetCompanionUrl(entry, set = 'p5') { return entry.companion ? `${assetRoot(set)}/${entry.companion}` : undefined; }
export function selectTerrainLod(screenHexWidth) { return screenHexWidth < 56 ? 'far' : screenHexWidth <= 96 ? 'medium' : 'close'; }
export function entryVisibleAtLod(entry, lod) { return Boolean(entry && (!entry.lod || entry.lod.includes(lod))); }
export function manifestEntryCount() { return entries.length; }
