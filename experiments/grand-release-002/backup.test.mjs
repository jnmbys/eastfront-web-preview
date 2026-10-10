import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';import {Campaign} from '../grand-release-001/territory.mjs';import {backupBeforeRelease} from './backup.mjs';
test('pre-release backup retains existing identity/current save, is immutable and checks corruption',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'release002-backup-')),id='c'.repeat(64),dir=path.join(root,'visitors',id);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(root,'visitor-key'),Buffer.alloc(32,7));fs.writeFileSync(path.join(dir,'visitor.json'),'{}');
 const adapter=new ReleaseAdapter({CampaignClass:Campaign,saveFile:path.join(dir,'campaign.json')});await adapter.saveFileNow();const original=fs.readFileSync(adapter.saveFile);
 backupBeforeRelease(root);const backup=path.join(root,'before-release002','visitors',id,'campaign.json');assert.deepEqual(fs.readFileSync(backup),original);assert.deepEqual(fs.readFileSync(path.join(root,'before-release002/visitor-key')),Buffer.alloc(32,7));
 adapter.c.version++;await adapter.saveFileNow();backupBeforeRelease(root);assert.deepEqual(fs.readFileSync(backup),original);assert.notDeepEqual(fs.readFileSync(adapter.saveFile),original);
 fs.writeFileSync(backup,'bad');assert.throws(()=>backupBeforeRelease(root),/CHECKSUM_FAILED/);assert.notDeepEqual(fs.readFileSync(adapter.saveFile),Buffer.from('bad'));
});
