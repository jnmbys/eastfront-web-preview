// Encode only already-authorized snapshots. Keying static/entity arrays avoids
// resending the complete map when a unit or one control flag changes.
const paths=[['units','id'],['warehouses','id'],['cities','items','id'],['game','message','payload','view','hexes','coord'],['game','message','payload','view','edges','key'],['game','message','payload','view','units','id'],['game','message','payload','model','hexes','coord'],['game','message','payload','model','edges','key'],['game','message','payload','model','units','id']];
function convert(doc,encode,owned=false){const d=owned?doc:structuredClone(doc);for(const spec of paths){const field=spec.at(-2),key=spec.at(-1);let p=d;for(const k of spec.slice(0,-2))p=p?.[k];if(!p||p[field]===undefined)continue;if(encode){if(!Array.isArray(p[field]))throw Error('EXPECTED_COMPLETE_AUTHORIZED_ARRAY');p[field]=Object.fromEntries(p[field].map(v=>[key==='coord'?`${v.coord.q},${v.coord.r}`:v[key],v]));}else p[field]=Object.values(p[field]);}return d;}
export const encodeView=d=>convert(d,true),decodeView=d=>convert(d,false);

// Only for a fresh detached authority snapshot; do not pass shared cached documents.
export const encodeOwnedView=d=>convert(d,true,true);

// Optional read-only decoder for immutable, ordered patch trees. Cache by object
// identity AND schema position, never by revision/id/side alone. Revoked entries
// disappear with the new dictionary; old snapshots are never amended in place.
const schema={children:{},cache:new WeakMap()};
for(const spec of paths){let n=schema;for(const k of spec.slice(0,-1))n=n.children[k]??={children:{},cache:new WeakMap()};n.keyed=true;}
const plain={children:{},cache:new WeakMap()};
function shared(x,n=plain){if(!x||typeof x!=='object')return x;const prior=n.cache.get(x);if(prior)return prior;
 const result=n.keyed?Object.values(x).map(v=>shared(v)):Array.isArray(x)?x.map(v=>shared(v)):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,shared(v,n.children[k]??plain)]));
 Object.freeze(result);n.cache.set(x,result);return result;
}
export const decodeSharedView=d=>shared(d,schema);
