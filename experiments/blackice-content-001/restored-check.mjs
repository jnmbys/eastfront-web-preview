import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {readSave} from '../grand-release-001/persistence.mjs';import {Campaign} from '../blackice-001/r1-campaign.mjs';import {canonical} from '../grand-play-mp022/sync.mjs';import {validate} from '../grand-division-002/inventory.mjs';
const [root,out]=process.argv.slice(2),id=fs.readdirSync(path.join(root,'visitors'))[0],save=readSave(path.join(root,'visitors',id,'blackice-001-r1/campaign.json')).campaign;
const a=new Campaign(),b=new Campaign();a.restore(save);b.restore(save);
// Read-only saved-state continuation: exercise the sole excluded legacy cache.
// The new ledger overrides legacy casualty recording and does not consume this cache.
a.econ.modern.lastPersonnel=structuredClone(save.econ.modern.lastPersonnel);
const hash=c=>createHash('sha256').update(canonical({tick:c.clock.tick,rng:c.clock.rng,units:c.state.units,ledger:c.clock.divisionLedger})).digest('hex');
const rows=[];for(let i=0;i<12;i++){a.advance();b.advance();validate(a.clock.divisionLedger);validate(b.clock.divisionLedger);assert.equal(hash(a),hash(b));rows.push({tick:a.clock.tick,hash:hash(a)});}
const c=new Campaign();c.restore(save);const e=c.econ.modern,n=e.net.GERMAN,h=n.hubs.find(x=>x.id==='GERMAN-depot-3');
const report={kind:'controlled read-only final-save continuations; no player save is written',legacyCacheExcluded:'econ.modern.lastPersonnel rebuilt by bindModels(true); legacy recordEquipmentLoss overridden',steps:rows,network:{tick:c.clock.tick,trainCapacity:c.clock.divisionLedger.nations.GERMAN.stock.TRAIN*e.balanceConfig.trainWork,trainDailyUsed:n.trainUsed,cargo:e.cargoHour.sides.GERMAN,hub:{id:h.id,capacity:h.capacity,dailyUsed:h.used,freightUsed:e.cargoHour.sides.GERMAN.hubs[h.id]??0}},works: c.clock.divisionLedger.balance.works['G-025']};
fs.writeFileSync(path.join(out,'restored-cache-control.json'),JSON.stringify(report,null,2));console.log('12-step cache control equal; hub',JSON.stringify(report.network.hub));
