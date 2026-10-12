export const VERSION='HOI4-FORTIFICATION-001-1';
export const config={cap:12,base:4500*2100/10800,extra:2500*2100/10800,penalty:.12,maxPenalty:.9,engineerDefense:.07};
export const key=h=>h.q+','+h.r;
export const cost=level=>config.base+config.extra*level;
export function legal(c,k,side){const h=c.state.hexes[k];return !!h&&h.control===side&&!['LAKE'].includes(h.terrain);}
export function blocked(c,q){if(q.kind!=='FORT')return '';if(!legal(c,q.hex,q.side))return '失守停工';return c.econ.modern.queue.some(x=>x.kind==='FORT'&&x.hex===q.hex&&x.status!=='DONE'&&x.serial<q.serial)?'等待前级工程':'';}
// Re-price only unstarted successors after cancellation/capture; invested work is never refunded.
export function syncCosts(c){if(!c.clock.forts)return;const next={...c.clock.forts.levels};for(const q of c.econ.modern.queue.filter(q=>q.kind==='FORT'&&q.status!=='DONE').sort((a,b)=>a.serial-b.serial)){const level=next[q.hex]??0;if(!q.progress)q.cost=cost(level);q.levelFrom=level;next[q.hex]=level+1;}}
export function finish(c,q){const f=c.clock.forts;f.levels[q.hex]=Math.min(config.cap,(f.levels[q.hex]??0)+1);}
// Accepted, width-admitted contacts only. A unit does not gain fort protection while attacking.
export function effect(c,target,source,pairs){const d=c.state.units[target],a=c.state.units[source],hex=key(d.hex),level=c.clock.forts?.levels[hex]??0;
 if(!level||c.state.hexes[hex]?.control!==d.side||d.side===a.side)return {level:0,effectiveLevel:0,directions:0,factor:1};
 const attacking=new Set(pairs.flatMap(b=>b.initiators??[]));if(attacking.has(target)||!attacking.has(source))return {level:0,effectiveLevel:0,directions:0,factor:1};
 const fronts=new Set();for(const b of pairs)for(const id of b.initiators??[]){const u=c.state.units[id];if(u.side===d.side)continue;const defender=b.units.find(x=>c.state.units[x].side===d.side&&key(c.state.units[x].hex)===hex);if(defender)fronts.add(key(u.hex));}
 const effectiveLevel=Math.max(1,level-Math.max(0,fronts.size-1));return {level,effectiveLevel,directions:fronts.size,factor:1-Math.min(config.maxPenalty,effectiveLevel*config.penalty)};
}
export function visibleForts(c,d){const v=d.game.message.payload.view,identified=new Set(v.identifiedHexKeys??[]);return v.hexes.filter(h=>h.control===d.viewer||identified.has(key(h.coord))).filter(h=>h.terrain!=='LAKE').map(h=>{const hex=key(h.coord),level=c.clock.forts.levels[hex]??0,queued=c.econ.modern.queue.filter(q=>q.kind==='FORT'&&q.hex===hex&&q.side===d.viewer&&q.status!=='DONE').length;return {hex,level,queued,cap:config.cap,controller:h.control,canBuild:h.control===d.viewer&&level+queued<config.cap&&!c.econ.modern.queue.some(q=>q.kind==='FORT'&&q.hex===hex&&q.status!=='DONE'&&q.side!==d.viewer),cost:cost(level+queued)};});}
