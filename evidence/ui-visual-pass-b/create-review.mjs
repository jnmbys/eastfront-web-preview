// Static review document. No gameplay handlers or browser capture claims.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {commandHeader,deploymentLocations,unitLabel} from '../../dist/app/ui/commandPresentation.js';
import {homeMarkup,createFreshProductionSession} from '../../dist/app/web/preview.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
const require=createRequire(import.meta.url),ts=require('typescript');
const before=execFileSync('git',['show','895eb360946dd822c2042c97b25b49f7db45276b:styles.css'],{encoding:'utf8'}),after=readFileSync('styles.css','utf8');
const old=execFileSync('git',['show','895eb360946dd822c2042c97b25b49f7db45276b:src/main.ts'],{encoding:'utf8'}),now=readFileSync('src/main.ts','utf8');
const presentation=createPresentationState(false,false);
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const model=deriveBrowserRenderModel(createFreshProductionSession(raw,17),presentation);
presentation.selectedDeploymentUnitId=model.deployment.roster[0].id;
const escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function roster(source){
 const declaration=source.match(/^function deploymentPanel.*$/m)[0];
 const emblem=source.includes('function rosterEmblem')?source.slice(source.indexOf('function rosterEmblem'),source.indexOf('function deploymentPanel')):'';
 const js=ts.transpileModule(emblem+declaration,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return Function('model','presentation','esc','sideLabel','deploymentLocations','unitLabel',js+';return deploymentPanel(model);')(model,presentation,escape,s=>s==='SOVIET'?'Soviet':'German',deploymentLocations,unitLabel);
}
const map='data:image/png;base64,'+readFileSync('evidence/vs2-002r-e/01-full-vs2-far.png').toString('base64');
function hud(rows,isAfter){return `<header class="topbar"><div class="brand"><span class="brand-mark">E</span><div><strong>EASTFRONT</strong><span>WEB PREVIEW · v0.0.10</span></div></div><div class="turn-strip ${isAfter?'command-hud':''}">${isAfter?commandHeader(model):'<span>TURN <strong>1</strong></span><span>SOVIET</span><span>DEPLOYMENT</span>'}</div><div class="resource-strip"><span>CP <strong>${model.cp[model.activeSide]}</strong></span><span>RP <strong>${model.rp[model.activeSide]}</strong></span><button class="menu-button">NEW GAME</button><button class="menu-button">PANEL</button></div></header><main class="workspace panel-open"><section class="map-card"><div class="map-toolbar"><div><strong>Strategic Reset F</strong><span>Static UI review · unchanged D terrain export</span></div><div class="map-controls"><button class="map-control-button">−</button><button class="map-control-button">+</button><button class="map-control-button">FIT</button></div></div><div class="map-wrap"><img src="${map}" style="width:100%;height:100%;object-fit:contain" alt="Checkpoint D map"/></div></section><aside class="side-panel"><section class="panel-block selection-block"><span class="eyebrow">${isAfter?'COMMAND PANEL':'SELECTED UNIT'}</span><strong>${escape(model.deployment.roster[0].id)}</strong></section>${rows}<section class="panel-block"><span class="eyebrow">CONTROL STATES</span><div class="button-row"><button class="secondary-action active">ACTIVE</button><button class="secondary-action" disabled>DISABLED</button></div><button class="primary-action">READY</button></section></aside></main>`;}
function frame(css,body){return `<iframe title="Visual comparison" srcdoc="${escape('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style>'+body)}"></iframe>`;}
let html='<!doctype html><meta charset="utf-8"><title>EASTFRONT · UI Visual Pass B</title><style>body{margin:24px;background:#101722;color:#eee5d4;font:16px system-ui}p{max-width:950px;line-height:1.6;color:#bac6d5}iframe{width:100%;height:800px;border:1px solid #7c6b50;margin-bottom:30px}h2{font:28px Georgia}a{color:#d8c39a}</style><h1>UI Visual Pass B · Before / After</h1><p>Static HTML comparison, not browser screenshots. Home uses production markup; deployment uses the actual production roster function and fresh scenario projection. HUD is a representative component arrangement with the unchanged D map export. Buttons have visual states but no game actions. Resize the window to inspect responsive CSS. This is not a live gameplay or tablet acceptance test.</p>';
for(const [name,css,source] of [['Before',before,old],['After',after,now]])html+=`<h2>${name} · Main menu</h2>`+frame(css,homeMarkup('DESKTOP'))+`<h2>${name} · HUD / Deployment / Controls</h2>`+frame(css,hud(roster(source),name==='After'));
writeFileSync('evidence/ui-visual-pass-b/BEFORE-AFTER.html',html);
