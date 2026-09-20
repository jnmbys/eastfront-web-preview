import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import vm from 'node:vm';
import * as l10n from '../dist/app/localization/index.js';
import {enUS} from '../dist/app/localization/en-US.js';
import {zhCN} from '../dist/app/localization/zh-CN.js';
import {issueText,issueMessage,issueKeys,reasonKeys} from '../dist/app/localization/issues.js';
import {languageControl,bindLanguageControl} from '../dist/app/localization/languageControl.js';
import * as preview from '../dist/app/web/preview.js';
import * as ui from '../dist/app/ui/commandPresentation.js';
import * as touch from '../dist/app/ui/deploymentTouch.js';
import {deploymentRejection} from '../dist/app/ui/deploymentPolish.js';
import {combatAttackPanel} from '../dist/app/ui/combatAttackPanel.js';
import * as intents from '../dist/app/interaction/intents.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup,renderCounter} from '../dist/app/render/coreSvg.js';
import {createLocalGameSession,controllerIdForSide} from '../dist/app/core-adapter/session.js';
import {coreHexKey,getLegalRetreatStepOptions} from '../dist/app/core-adapter/core.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
const {t,setLocale,getLocale,formatMessage,resolveTranslation,getMissingKeys,clearMissingKeys}=l10n;
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const main=readFileSync('dist/app/main.js','utf8');
const setup=(seed=17)=>({s:createLocalGameSession(raw,seed),p:createPresentationState(false,false),d:touch.createDeploymentTouch()});
function panels(s,p,d){
 const ctx=vm.createContext({...l10n,...ui,...preview,...touch,issueText,deploymentRejection,combatAttackPanel,coreHexKey,session:s,presentation:p,deploymentTouch:d,developerUi:false,esc:ui.escapeUi});
 vm.runInContext(main.slice(main.indexOf('function sideLabel('),main.indexOf('function startNewGame(')),ctx);
 vm.runInContext(main.slice(main.indexOf('function sidePanelMarkup('),main.indexOf('function refreshDynamicView(')),ctx);
 return ctx;
}
function switchControl(repaint){
 const control={value:'zh-CN',addEventListener(event,handler){assert.equal(event,'change');this.change=handler;},focus(){}};
 const root={querySelectorAll(selector){return selector==='[data-language-select]'?[control]:selector==='details'?this.details:[];},querySelector(selector){return selector==='[data-language-select]'?control:this.scrolls[selector]??null;},details:[{open:true},{open:false}],scrolls:{'.command-panel-scroll':{scrollTop:71},'.roster-list':{scrollTop:83},'.location-grid':{scrollTop:29}}};
 bindLanguageControl(root,()=>{repaint();root.details=[{open:false},{open:false}];for(const v of Object.values(root.scrolls))v.scrollTop=0;});
 return {root,change(next){control.value=next;control.change();}};
}
function noEnglishProse(html){
 const text=html.replace(/<[^>]*>/g,' ').replace(/&[^;]+;/g,' ').replace(/EASTFRONT|English|UI-009R2D2|CRT|\b(?:G|S|B)-[A-Z\d-]+\b|\bv\d[\d.]+/g,'');
 assert.doesNotMatch(text,/\b[A-Za-z]{3,}\b/,text.slice(0,500));
}
test('zh-CN is the default player language',()=>{assert.equal(getLocale(),'zh-CN');assert.match(preview.homeMarkup('DESKTOP'),/>新游戏</);assert.match(languageControl(),/value="zh-CN"[^>]*selected/);});
test('zh-CN and en-US cover every stable key with identical interpolation parameters',()=>{
 assert.deepEqual(Object.keys(zhCN).sort(),Object.keys(enUS).sort());
 const params=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
 for(const key of Object.keys(enUS)){assert(enUS[key].trim(),key);assert(zhCN[key].trim(),key);assert.deepEqual(params(enUS[key]),params(zhCN[key]),key);}
});
test('English fallback, missing key and missing parameter detection are explicit',()=>{
 clearMissingKeys();const sparse={'zh-CN':{},'en-US':enUS};
 assert.equal(resolveTranslation('game.newGame','zh-CN',sparse),'NEW GAME');
 assert(getMissingKeys().includes('zh-CN:game.newGame'));
 assert.equal(resolveTranslation('does.not.exist','zh-CN',sparse),'[does.not.exist]');
 assert(getMissingKeys().includes('en-US:does.not.exist'));
 t('game.turn');assert(getMissingKeys().includes('parameter:game.turn:turn'));clearMissingKeys();
});
test('all canonical player-facing enums and validation codes have mappings',()=>{
 const types=readFileSync('vendor/eastfront-digital-core/dist/core/types.d.ts','utf8');
 setLocale('zh-CN');for(const name of ['TerrainType','UnitType','SupplyState','CombatStage','GamePhase']){
  const line=types.match(new RegExp(`export type ${name} = ([^;]+);`))[1];
  for(const [,value] of line.matchAll(/'([^']+)'/g)){const label=name==='GamePhase'?l10n.phaseName(value):l10n.enumLabel(value);assert.notEqual(label,value,`${name}:${value}`);}
 }
 const folders=['vendor/eastfront-digital-core/dist/rules','vendor/eastfront-digital-core/dist/engine'];
 for(const dir of folders)for(const file of readdirSync(dir).filter(f=>f.endsWith('.js')&&f!=='integrity.js')){
  const text=readFileSync(`${dir}/${file}`,'utf8');for(const [,code]of text.matchAll(/code: '([^']+)'/g))assert(issueKeys[code],code);
 }
 assert(reasonKeys.INSUFFICIENT_RP);assert(reasonKeys.REINFORCEMENT_ENTRY_IN_GERMAN_ZOC);
});
test('stored feedback and Core rejections translate at render time, retaining identifiers',()=>{
 const {s,p,d}=setup();const before=JSON.stringify(s.state);const model=deriveBrowserRenderModel(s,p),id=model.deployment.roster[0].id;
 intents.selectDeploymentRosterUnit(p,id);touch.chooseDeploymentTarget(d,model,id,model.deployment.zoneKeys[0]);
 setLocale('zh-CN');assert.match(ui.deploymentFeedback(d),/已选择位置/);
 setLocale('en-US');assert.match(ui.deploymentFeedback(d),/Position selected/);
 const issue={code:'INVALID_SUPPORT',message:'Original engine text',details:{reason:'INSUFFICIENT_RP'}},copy=JSON.stringify(issue),message=issueMessage(issue);
 setLocale('zh-CN');assert.equal(formatMessage(message),'补充点不足。');setLocale('en-US');assert.equal(formatMessage(message),'Original engine text');
 assert.equal(JSON.stringify(issue),copy);assert.equal(JSON.stringify(s.state),before);
});
test('language preference persists when available and works when storage is denied',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let saved='en-US';
 try{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>saved,setItem:(key,value)=>{assert.equal(key,'eastfront.language');saved=value;}}});
  const restored=await import('../dist/app/localization/index.js?storage-test');assert.equal(restored.getLocale(),'en-US');restored.setLocale('zh-CN');assert.equal(saved,'zh-CN');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('denied');}});
  const denied=await import('../dist/app/localization/index.js?storage-denied');assert.equal(denied.getLocale(),'zh-CN');assert.doesNotThrow(()=>denied.setLocale('en-US'));assert.equal(denied.getLocale(),'en-US');
 }finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});
test('real language change handler preserves GameState, RNG, camera, drafts and scroll positions',ctx=>{
 const {s,p,d}=setup();const m=deriveBrowserRenderModel(s,p);intents.selectDeploymentRosterUnit(p,m.deployment.roster[0].id);touch.chooseDeploymentTarget(d,m,p.selectedDeploymentUnitId,m.deployment.zoneKeys[0]);
 const camera={zoom:1.85,panX:112,panY:-48};p.pathDraft=[{q:2,r:-1}];p.attackUnitIds=['G-PZ-01'];
 const model=deriveBrowserRenderModel(s,p),panel=panels(s,p,d),state=s.state,random=s.state.random,before=JSON.stringify({state:s.state,p,d,camera});
 let text='',renders=0;ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw new Error('Language switching must not request entropy');});
 const control=switchControl(()=>{text=ui.commandHeader(model)+panel.sidePanelMarkup(model)+coreSvgMarkup(model,{debug:false,rendererMode:'production',staticTerrainSurface:true});renders++;});
 for(const language of ['en-US','zh-CN']){control.change(language);assert.equal(s.state,state);assert.equal(s.state.random,random);assert.equal(JSON.stringify({state:s.state,p,d,camera}),before);assert.equal(control.root.scrolls['.command-panel-scroll'].scrollTop,71);assert.equal(control.root.scrolls['.roster-list'].scrollTop,83);assert.equal(control.root.details[0].open,true);}
 assert.equal(renders,2);assert.match(text,/确认部署/);assert.deepEqual(getMissingKeys(),[]);
 // Assert the real main binder uses this handler with the existing render path.
 assert.match(main,/bindLanguageControl\(root, render\)/);assert.match(main,/function bindMapViewport\(\)[\s\S]*?applyMapViewport\(\)/);
});
function deployBoth({s,p,d}){
 for(const side of ['SOVIET','GERMAN']){
  const special=side==='SOVIET'?{'S-I-01':'3,-1'}:{'G-PZ-01':'2,-1'},counts={};
  const roster=s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>Number(!(a.id in special))-Number(!(b.id in special))||a.id.localeCompare(b.id));
  for(const row of roster){const m=deriveBrowserRenderModel(s,p),key=special[row.id]??m.deployment.zoneKeys.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));intents.selectDeploymentRosterUnit(p,row.id);assert(touch.chooseDeploymentTarget(d,m,row.id,key));touch.confirmDeploymentTarget(d,s,p);assert(s.lastResult.accepted,JSON.stringify(s.lastResult.issues));counts[key]=(counts[key]??0)+1;}
  intents.readyForPhase(s,p);assert(s.lastResult.accepted);intents.confirmPrivacyGate(s,p);
 }
}
function driveCombat(f){
 const {s,p}=f;intents.selectCounter(s,p,'G-PZ-01');intents.selectCounter(s,p,'S-I-01');assert(deriveBrowserRenderModel(s,p).combat.attackDraft.preview);
 intents.declareAttack(s,p);assert(s.lastResult.accepted);const bid=s.lastResult.battleId;intents.confirmPrivacyGate(s,p);intents.passCombatReaction(s,p);assert(s.lastResult.accepted);
 for(let guard=0;s.state.pendingDecision&&guard<20;guard++){
  if(p.privacyGate)intents.confirmPrivacyGate(s,p);const pending=s.state.pendingDecision;
  switch(pending.kind){
   case 'LOSS_ALLOCATION':for(let i=0;i<pending.lossSteps;i++)intents.appendLossDraft(s,p,pending.eligibleUnitIds[i%pending.eligibleUnitIds.length]);intents.commitLosses(s,p);break;
   case 'RETREAT':for(const id of pending.unitIds){intents.selectRetreater(p,id);for(let i=0;i<pending.retreatSteps;i++){const model=deriveBrowserRenderModel(s,p),next=model.combat.retreat.options[0];if(!next)break;intents.extendRetreatDraft(s,p,next);}}intents.commitRetreat(s,p);break;
   case 'ADVANCE_AFTER_COMBAT':intents.passAdvance(s,p);break;
   case 'BREAKTHROUGH_OPTION':intents.passBreakthrough(s,p);break;
   case 'SCHWERPUNKT_OPTION':intents.passSchwerpunkt(s,p);break;
   default:throw new Error(pending.kind);
  }
  assert(s.lastResult.accepted,JSON.stringify(s.lastResult.issues));
 }
 assert.equal(s.state.pendingDecision,null);if(p.privacyGate)intents.confirmPrivacyGate(s,p);
 assert.equal(s.state.combatTransactions[bid].stage,'CLOSED');return s.state.combatTransactions[bid].resolution;
}
test('Chinese production flow: new game, deployment confirmation, movement plan, attack preview, resolve, end phase; same state as English',()=>{
 const outcomes=[];
 for(const language of ['zh-CN','en-US']){
  setLocale(language);const f=setup(),{s,p,d}=f;const panel=panels(s,p,d);if(language==='zh-CN')noEnglishProse(preview.homeMarkup('IPAD_LANDSCAPE'));
  deployBoth(f);assert.equal(s.state.phase,'GERMAN_SUPPLY_RAIL');intents.readyForPhase(s,p);assert.equal(s.state.phase,'GERMAN_MOVEMENT');
  let next;for(const candidate of Object.values(s.state.units).filter(u=>u.side==='GERMAN'&&u.id!=='G-PZ-01')){intents.selectCounter(s,p,candidate.id);next=deriveBrowserRenderModel(s,p).moveOptions.find(o=>o.legal);if(next)break;}assert(next);const before=JSON.stringify(s.state);intents.extendMoveDraft(s,p,next.hex);assert.equal(JSON.stringify(s.state),before);
  if(language==='zh-CN')noEnglishProse(panel.sidePanelMarkup(deriveBrowserRenderModel(s,p)));intents.cancelMoveDraft(p);intents.readyForPhase(s,p);assert.equal(s.state.phase,'GERMAN_COMBAT');
  intents.selectCounter(s,p,'G-PZ-01');intents.selectCounter(s,p,'S-I-01');if(language==='zh-CN'){const html=panel.sidePanelMarkup(deriveBrowserRenderModel(s,p));assert.match(html,/>攻击<\/button>/);noEnglishProse(html);}
  const resolution=driveCombat(f);if(language==='zh-CN'){const html=panel.sidePanelMarkup(deriveBrowserRenderModel(s,p));noEnglishProse(html);assert(html.includes(resolution.crtResult));}
  intents.readyForPhase(s,p);assert(s.lastResult.accepted);assert.equal(s.state.phase,'GERMAN_RECOVERY');outcomes.push(JSON.stringify(s.state));
 }
 assert.equal(outcomes[0],outcomes[1]);assert.deepEqual(getMissingKeys(),[]);
});
test('every pending Combat UX panel and all actual phases render Chinese with CRT codes retained',()=>{
 setLocale('zh-CN');const {s,p,d}=setup(),panel=panels(s,p,d);deployBoth({s,p,d});
 for(const phase of ['GERMAN_SUPPLY_RAIL','GERMAN_MOVEMENT','GERMAN_COMBAT','GERMAN_RECOVERY','GERMAN_ENTRENCHMENT','SOVIET_REINFORCEMENT_SUPPLY','SOVIET_MOVEMENT','SOVIET_COMBAT','SOVIET_RECOVERY','SOVIET_ENTRENCHMENT']){
  s.state.phase=phase;s.state.activeSide=phase.startsWith('GERMAN')?'GERMAN':'SOVIET';s.activeViewerControllerId=controllerIdForSide(s,s.state.activeSide);noEnglishProse(panel.sidePanelMarkup(deriveBrowserRenderModel(s,p)));
 }
 const base=deriveBrowserRenderModel(s,p),battle={resolution:{dice:{die1:1,die2:2,total:3},crtResult:'EX',attackerLossSteps:1,defenderLossSteps:1,defenderRetreatSteps:0}};
 for(const kind of ['DEFENDER_REACTION','LOSS_ALLOCATION','RETREAT','ADVANCE_AFTER_COMBAT','BREAKTHROUGH_OPTION','SCHWERPUNKT_OPTION']){
  const model={...base,combat:{history:[],battle,pending:{kind,battleId:'B-000001',decisionOwnerControllerId:s.activeViewerControllerId,eligibleArtilleryUnitIds:[],eligibleUnitIds:['G-PZ-01']},loss:{steps:1,eligibleUnitIds:['G-PZ-01'],capacityByUnitId:{'G-PZ-01':2},draft:[]},retreat:{steps:1,unitIds:['S-I-01'],activeUnitId:'S-I-01',options:[{q:3,r:-1}],drafts:{}},breakthrough:{maxHexes:2,eligibleUnitIds:['G-PZ-01'],selectedUnitId:'G-PZ-01',path:[]},schwerpunkt:{target:{q:3,r:-1},eligibleUnitIds:['G-PZ-01']}}};
  const html=panel.combatPanel(model);noEnglishProse(html);assert(html.includes('>EX<'));assert(html.includes('>1</span><span class="die">2</span>'));
 }
 for(const gate of ['COMBAT_DECISION','PASS_TO_GERMAN','REVEAL_BOTH','PASS_TURN_TO_GERMAN','PASS_TURN_TO_SOVIET'])noEnglishProse(preview.privacyHandoffMarkup(gate,'Soviet'));
 noEnglishProse(preview.gameOverMarkup('GERMAN','GERMAN_CAPITAL_CAPTURE_FINAL_TURN',12));assert.deepEqual(getMissingKeys(),[]);
});
test('language changes leave the next dice sequence identical; New Game still requests fresh seeds independently of terrain',ctx=>{
 setLocale('zh-CN');let calls=0;const seeds=[0,123456789,987654321];ctx.mock.method(globalThis.crypto,'getRandomValues',array=>{array[0]=seeds[calls++];return array;});
 const a=preview.createFreshProductionSession(raw);const before=JSON.stringify(a.state.random);const expected=new SeededRNG(structuredClone(a.state.random));const dice=Array.from({length:24},()=>expected.rollDie(6));
 const control=switchControl(()=>ui.commandHeader(deriveBrowserRenderModel(a,createPresentationState())));control.change('en-US');control.change('zh-CN');assert.equal(calls,2);assert.equal(JSON.stringify(a.state.random),before);
 const actual=new SeededRNG(structuredClone(a.state.random));assert.deepEqual(Array.from({length:24},()=>actual.rollDie(6)),dice);
 const b=preview.createFreshProductionSession(raw);assert.equal(calls,3);assert.notEqual(a.state.random.seed,b.state.random.seed);assert.deepEqual(a.state.hexes,b.state.hexes);assert.equal(preview.TERRAIN_VISUAL_SEED,17);
});
test('counter mechanics and symbols are identical across locales; only accessible text changes',()=>{
 const counter={id:'G-PZ-01',side:'GERMAN',type:'PANZER',step:1,stats:{attack:8,defense:4,movement:6},supplyState:'OUT_OF_SUPPLY',hex:{q:2,r:-1},selected:true,entrenched:true};
 const normalize=s=>s.replace(/aria-label="[^"]*"/g,'').replace(/<title>[^<]*<\/title>/g,'');
 setLocale('en-US');const a=renderCounter(counter,1,2);setLocale('zh-CN');const b=renderCounter(counter,1,2);assert.equal(normalize(a),normalize(b));assert.match(b,/补给中断/);assert.match(b,/本格共有 2 个单位/);
});
test('main render and binding preserve the existing camera transform during language switching',()=>{
 const {s,p,d}=setup();const context=panels(s,p,d);const elements={};
 for(const id of ['#map-wrap','#eastfront-map','#zoom-readout'])elements[id]={style:{},dataset:{},textContent:'',addEventListener(){}};
 const control={value:'zh-CN',addEventListener(event,handler){this.change=handler;},focus(){}};
 const root={innerHTML:'',querySelectorAll:selector=>selector==='[data-language-select]'?[control]:[],querySelector:selector=>selector==='[data-language-select]'?control:null};
 Object.assign(context,{root,document:{querySelector:selector=>elements[selector]??null,querySelectorAll:()=>[]},window:{innerWidth:1180,innerHeight:820},appStatus:'PLAYING',mapViewport:{zoom:1.7,panX:81,panY:-53},deriveBrowserRenderModel,languageControl,bindLanguageControl,coreSvgMarkup,mapRenderOptions:()=>({debug:false,rendererMode:'production',staticTerrainSurface:true}),mountCachedTerrainSurface(){},paintDeploymentFocus(){},bindDynamic(){},fatalMessage:'',startNewGame(){throw new Error('Must not start a game');},defaultMapViewport(){throw new Error('Must not reset camera');}});
 vm.runInContext(main.slice(main.indexOf('function applyMapViewport('),main.indexOf('function mapRenderOptions(')),context);
 vm.runInContext(main.slice(main.indexOf('function render('),main.indexOf('function paintCombatTargets(')),context);
 const state=s.state,camera=context.mapViewport,before=JSON.stringify({state:s.state,p,d,camera});
 context.render();const transform=elements['#eastfront-map'].style.transform;assert.equal(transform,'translate(81px, -53px) scale(1.7)');
 for(const language of ['en-US','zh-CN']){control.value=language;control.change();assert.equal(context.mapViewport,camera);assert.equal(s.state,state);assert.equal(elements['#eastfront-map'].style.transform,transform);assert.equal(JSON.stringify({state:s.state,p,d,camera}),before);}
 assert.match(root.innerHTML,/确认部署|完成部署阶段/);assert.deepEqual(getMissingKeys(),[]);
});
test('fatal-screen messages also retranslate without changing diagnostics',()=>{
 const message=l10n.msg('game.resourceFailure',{detail:'HTTP 404'});setLocale('zh-CN');assert.match(preview.fatalMarkup(message),/无法加载游戏所需资源/);setLocale('en-US');assert.match(preview.fatalMarkup(message),/Required production resources could not be loaded/);assert.match(preview.fatalMarkup(message),/HTTP 404/);
});
