export const VERSION='HOI4-FACTORY-CONVERSION-001-1';
export const costs={MIL:1800*4000/7200,CIV:2100*9000/10800};
export const active=q=>q.kind==='CONVERT'&&q.status!=='DONE';
export function valid(c,q){const f=c.econ.modern.facilities[q.target];return f&&f.kind===q.from&&(f.conversionRevision??0)===q.assetRevision;}
export function locked(c,f,side){return !!c.clock.factoryConversion&&c.econ.modern.queue.some(q=>active(q)&&q.side===side&&q.target===f.id&&q.started&&valid(c,q)&&c.state.hexes[f.hex]?.control===side);}
export function reason(c,q){if(q.kind!=='CONVERT')return '';if(!valid(c,q))return '原厂用途已变化，项目失效';const f=c.econ.modern.facilities[q.target];return f.damage>=1?'厂房完全损坏，先维修':'';}
export function reconcile(c){if(!c.clock.factoryConversion)return;for(const q of c.econ.modern.queue)if(active(q)&&c.state.hexes[q.hex]?.control===q.side&&!valid(c,q)){q.status='DONE';q.invalidated=true;q.outcome='原厂用途已变化；旧工时不转移、不退款';q.assigned=[];q.rate=0;}}
export function begin(c,plan){for(const row of plan.rows){const q=c.econ.modern.queue.find(q=>q.id===row.id);if(!active(q)||q.started||!row.assigned.length)continue;q.started=true;q.startedTick=c.clock.tick;for(const l of Object.values(c.econ.modern.lines))l.factories=l.factories.filter(id=>id!==q.target);c.econ.modern.ledger.push({kind:'CONVERSION_STARTED',side:q.side,tick:c.clock.tick,project:q.id,target:q.target});}}
export function finish(c,q){const f=c.econ.modern.facilities[q.target];if(!valid(c,q))throw Error('CONVERSION_ASSET_CHANGED');f.kind=q.to;f.conversionRevision=(f.conversionRevision??0)+1;const art=c.econ.ux.facilities[f.id];if(art)art.economicKind=q.to;q.outcome='转换完成；损伤保留，新军厂需分配产线';}
