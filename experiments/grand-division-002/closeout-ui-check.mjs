import assert from 'node:assert/strict';import fs from 'node:fs';
import {adoptPreview,integratedPanel} from '../../dist/app/playable/integratedDesigner.js';
import {Campaign} from './authority.mjs';import {attributes} from './combat.mjs';
const c=new Campaign(),d=c.snapshot(),p={data:d},u=d.divisions.integrated.units[0],base=d.divisions.integrated.templates[0],target=structuredClone(base);target.support[0]='ENGINEER';
const preview=adoptPreview(p,target,u),a=attributes(target,u);assert.equal(preview.attack,a.effective.softAttack);assert.equal(preview.defense,a.effective.defense);assert.equal(preview.org,a.paper.orgMax);
const html=integratedPanel(p);for(const label of ['当前','换编后未补齐','目标满编','按比例重分会暂时降低现役步兵贡献'])assert.ok(html.includes(label));assert.ok(html.indexOf('采用前核对')<html.indexOf('id="integrated-adopt"'));
assert.equal(d.divisions.integrated.reception.personnelDay,300);assert.equal(d.divisions.integrated.reception.equipmentDay,10);
fs.mkdirSync('evidence/grand-division-002/closeout',{recursive:true});fs.writeFileSync('evidence/grand-division-002/closeout/adoption-preview.json',JSON.stringify({kind:'compiled-UI-projection-not-browser',current:c.divisionAttributes(u.id),projected:preview,authoritative:a,labelsBeforeAdopt:true},null,2));console.log('UI projection agrees with authoritative attributes; three-state comparison precedes adopt action');
