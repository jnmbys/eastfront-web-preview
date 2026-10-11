from pathlib import Path
p=Path('playable.css');s=p.read_text(encoding='utf8').replace('`n#eastfront-map','\n#eastfront-map');p.write_text(s,encoding='utf8')
p=Path('experiments/hoi4-map-province-001/stage1-check.mjs');s=p.read_text();s=s.replace('assert.deepEqual(b.econ,a.econ);',"const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>['ms','maxMs','networkTiming','performance'].includes(k)?undefined:v));assert.deepEqual(normalized(b.econ),normalized(a.econ));");p.write_text(s)
