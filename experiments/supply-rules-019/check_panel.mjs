// Render the existing pure panel function with a real branch unit snapshot.
// This is a text-render check, not browser acceptance.
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {defaultRules,getUnitStats} from '../supply-exp-005/core/dist/index.js';
const require=createRequire(import.meta.url),ts=require(process.argv[2]);
const source=fs.readFileSync(new URL('../../src/experimental/supplyClient.ts',import.meta.url),'utf8');
const tail=source.slice(source.indexOf('export function supplyPanel('));
const compiled=ts.transpileModule(tail,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const context={exports:{}};vm.runInNewContext(compiled,context);
const report=JSON.parse(fs.readFileSync(new URL('./evidence/choices.json',import.meta.url),'utf8'));
const b=report.branches.find(x=>x.name==='concentrate_near_engineer');
const u=b.after.units['G-PZ-01'];
const s={version:'SUPPLY-INTEGRATE-015-v1',mode:'new',profile:'SUPPLY-CAMPAIGN-010-A-unbalanced',owner:'GERMAN',
units:[{id:'G-PZ-01',stock:u.stock,reserve:u.target,debt:u.debt,effect:u.debt_only_effect}],
receipt:null,ledger:[],seconds:null,next:'苏军回合末配送；恢复在已提交配送后生效'};
const html=context.exports.supplyPanel({supply:s},'G-PZ-01');
const actual=getUnitStats({templateId:'G-PANZER',step:0,expSupply:{attackFactor:u.next_direct_attack_effect.factor,movementCap:null}},defaultRules).attack;
const result={kind:'pure existing UI function; no browser',branch:b.name,unit:'G-PZ-01',stock:u.stock,debt:u.debt,
displayed_factor:u.debt_only_effect.factor,next_direct_attack_factor:u.next_direct_attack_effect.factor,
base_attack:defaultRules.unitTemplates['G-PANZER'].steps[0].attack,next_direct_attack_strength:actual,
shows_quarter_unit:html.includes('¼')||html.includes('0.25')||html.includes('四分之一'),
caveat_present:html.includes('攻击还会按实际可支付储备减效'),
rendered_text:html.replace(/<[^>]+>/g,' ')};
if(!html.includes('攻击系数 1')||u.next_direct_attack_effect.factor!==0.5||result.shows_quarter_unit)throw Error('Observed UI mismatch not reproduced');
fs.writeFileSync(new URL('./evidence/panel-check.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
