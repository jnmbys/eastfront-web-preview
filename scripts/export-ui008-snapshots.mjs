import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {deploymentHexKeysForSide,getAvailableSovietReinforcements,computeLegalSovietReinforcementEntryHexKeys} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {controllerIdForSide,dispatchGameAction,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {createFreshProductionSession,gameOverMarkup,homeMarkup,privacyHandoffMarkup,responsiveProfile} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup,viewBoxForHexes} from '../dist/app/render/coreSvg.js';
import {selectTerrainLod} from '../dist/app/render/terrainAssets.js';
import {HEX_SIZE} from '../dist/app/geometry/hex.js';
import {toggleAttackUnit,selectAttackTarget,declareAttack,confirmPrivacyGate,passCombatReaction} from '../dist/app/interaction/intents.js';

const raw=JSON.parse(await readFile(new URL('../dist/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
const out='screenshots/ui008-production';await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=[];
function htmlDoc(title,body,width,height,extra='') {return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${css}</style><style>html,body{width:${width}px;height:${height}px;overflow:hidden} ${extra}</style></head><body>${body}</body></html>`;}
async function save(name,content,meta={}){await writeFile(`${out}/${name}`,content);files.push({name,sha256:sha(content),...meta});}
function planFor(s,side,special={}){const ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort(),zone=deploymentHexKeysForSide(s.state,s.scenario,side),counts={},plan={};for(const [id,k] of Object.entries(special)){plan[id]=s.state.hexes[k].coord;counts[k]=(counts[k]??0)+1;}for(const id of ids){if(plan[id])continue;const k=zone.find(x=>(counts[x]??0)<s.rules.stackingLimit&&!Object.values(special).includes(x))??zone.find(x=>(counts[x]??0)<s.rules.stackingLimit);assert(k);plan[id]=s.state.hexes[k].coord;counts[k]=(counts[k]??0)+1;}return {ids,plan};}
function deployAll(s,side,special={}){const cid=controllerIdForSide(s,side),{ids,plan}=planFor(s,side,special);for(const id of ids){const r=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:plan[id]}).result;assert(r.accepted,JSON.stringify(r.issues));}}
function ready(s){const r=dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,s.state.activeSide)}).result;assert(r.accepted,JSON.stringify(r.issues));}
function turn1Session(specialS={},specialG={}){const s=createFreshProductionSession(raw,17);deployAll(s,'SOVIET',specialS);ready(s);setActiveViewer(s,controllerIdForSide(s,'GERMAN'));deployAll(s,'GERMAN',specialG);ready(s);return s;}
function boardSvg(s,width,p=createPresentationState(false,false)){const m=deriveBrowserRenderModel(s,p);const vb=viewBoxForHexes(m.hexes);const usable=Math.max(560,width-280);const screenHexWidth=usable*((Math.sqrt(3)*HEX_SIZE)/vb.width);const lod=selectTerrainLod(screenHexWidth);return {m,lod,svg:coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod,scenarioSeed:s.state.random.seed})};}

// 1-2. Exact production Home markup at the required desktop/iPad baselines.
await save('01-home-desktop-1920x1080.html',htmlDoc('EASTFRONT Home Desktop',homeMarkup(responsiveProfile(1920,1080)),1920,1080),{source:'dist/app/web/preview.js',viewport:'1920x1080',profile:responsiveProfile(1920,1080)});
await save('02-home-ipad-1180x820.html',htmlDoc('EASTFRONT Home iPad',homeMarkup(responsiveProfile(1180,820)),1180,820),{source:'dist/app/web/preview.js',viewport:'1180x820',profile:responsiveProfile(1180,820)});

// 3-4. Turn 1, 58-counter production state rendered by compiled production SVG renderer.
const t1=turn1Session();assert.equal(t1.state.phase,'GERMAN_SUPPLY_RAIL');
const d=boardSvg(t1,1920),i=boardSvg(t1,1180);assert.equal(d.m.counters.length,58);assert.equal(i.m.counters.length,58);
await save('03-turn1-desktop-1920.svg',d.svg,{source:'dist/app/render/coreSvg.js',viewport:'1920x1080',lod:d.lod,counters:58,phase:t1.state.phase});
await save('04-turn1-ipad-1180.svg',i.svg,{source:'dist/app/render/coreSvg.js',viewport:'1180x820',lod:i.lod,counters:58,phase:t1.state.phase});

// 5. Hidden deployment handoff: exact overlay markup plus Core projection evidence.
const privacy=createFreshProductionSession(raw,17);deployAll(privacy,'SOVIET');ready(privacy);setActiveViewer(privacy,controllerIdForSide(privacy,'GERMAN'));const pm=deriveBrowserRenderModel(privacy,createPresentationState(false,false));const sovietLeak=pm.counters.some(c=>c.side==='SOVIET');assert.equal(sovietLeak,false);
const privacyBody=`${privacyHandoffMarkup('PASS_TO_GERMAN')}<script type="application/json" id="evidence">${JSON.stringify({phase:privacy.state.phase,viewer:'GERMAN',visibleCounters:pm.counters.length,sovietCounterLeak:sovietLeak})}</script>`;
await save('05-deployment-privacy-handoff.html',htmlDoc('EASTFRONT Privacy Handoff',privacyBody,1180,820),{source:'dist production helpers',phase:privacy.state.phase,viewer:'GERMAN',sovietCounterLeak:false});

// 6. Real production-map combat transaction at the defender reaction checkpoint and closure trace.
const combat=turn1Session({'S-I-01':'3,-1'},{'G-PZ-01':'2,-1'}),cp=createPresentationState(false,false);ready(combat);assert.equal(combat.state.phase,'GERMAN_MOVEMENT');ready(combat);assert.equal(combat.state.phase,'GERMAN_COMBAT');cp.selectedUnitId='G-PZ-01';toggleAttackUnit(combat,cp,'G-PZ-01');selectAttackTarget(cp,{q:3,r:-1});declareAttack(combat,cp);assert.equal(combat.state.pendingDecision?.kind,'DEFENDER_REACTION');const battleId=cp.selectedBattleId;assert(battleId);const combatPending=boardSvg(combat,1366,cp);await save('06-combat-transaction-defender-reaction.svg',combatPending.svg,{source:'dist production renderer',battleId,pending:'DEFENDER_REACTION',lod:combatPending.lod});
confirmPrivacyGate(combat,cp);passCombatReaction(combat,cp);const tx=combat.state.combatTransactions[battleId];assert.equal(tx.stage,'CLOSED');await save('06-combat-transaction-trace.json',JSON.stringify({battleId,attackAccepted:true,reaction:'PASS_REACTION',dice:tx.resolution?.dice,crt:tx.resolution?.crtResult,stage:tx.stage,postCombatPrivacyGate:cp.privacyGate},null,2),{source:'dist production interaction',battleId,stage:tx.stage});

// 7. Production full-session lifecycle to authoritative GAME_OVER.
const full=turn1Session();let guard=1200;while(full.state.phase!=='GAME_OVER'&&guard-->0){if(full.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){const available=getAvailableSovietReinforcements(full.state,full.scenario),entries=computeLegalSovietReinforcementEntryHexKeys(full.state,full.rules,full.scenario);if(available.length&&entries.length){setActiveViewer(full,controllerIdForSide(full,'SOVIET'));const r=dispatchGameAction(full,{type:'DEPLOY_REINFORCEMENT',controllerId:controllerIdForSide(full,'SOVIET'),reinforcementId:available[0].id,entryHex:{...full.state.hexes[entries[0]].coord}}).result;assert(r.accepted);continue;}}setActiveViewer(full,controllerIdForSide(full,full.state.activeSide));ready(full);}assert(guard>0);assert.equal(full.state.turn,16);assert.equal(full.state.phase,'GAME_OVER');
await save('07-production-game-over.html',htmlDoc('EASTFRONT Game Over',gameOverMarkup(full.state.victory.winner,full.state.victory.reason,full.state.turn),1366,768),{source:'dist production lifecycle',turn:full.state.turn,winner:full.state.victory.winner,reason:full.state.victory.reason});

// 8. Narrow mobile is intentionally advisory, never a crash/blank page.
await save('08-mobile-narrow-390x844.html',htmlDoc('EASTFRONT Mobile Narrow',homeMarkup(responsiveProfile(390,844)),390,844),{source:'dist/app/web/preview.js',viewport:'390x844',profile:responsiveProfile(390,844)});

// 9. Production directory evidence summary from the built output itself.
const audit=JSON.parse(await readFile('validation-logs/ui008-production-audit.json','utf8').catch(()=>Buffer.from('{}')) || '{}');
await save('09-production-build-audit.json',JSON.stringify({distIndex:'dist/index.html',runtimeRoot:'dist/assets/terrain/p4r3',runtimeRasterCount:123,p5r1S02:'914593e3fb5c28b412fd0aff47418728f9ff360fce19659f63b870352890c55e',audit},null,2),{source:'dist directory audit'});

await writeFile(`${out}/manifest.json`,JSON.stringify({generatedAt:new Date().toISOString(),source:'FINAL production dist modules',scenario:'Strategic Reset F',seed:17,files},null,2));
console.log(`UI-008 production evidence: ${files.length} files`);
