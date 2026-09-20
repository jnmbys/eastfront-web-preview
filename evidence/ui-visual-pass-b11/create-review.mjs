// Static UI fixture from production deployment markup, not a browser screenshot.
import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {createFreshProductionSession} from '../../dist/app/web/preview.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {deploymentLocations,deploymentConfirm,deploymentFeedback,unitDescription,unitLabel,escapeUi,commandHeader} from '../../dist/app/ui/commandPresentation.js';
import {createDeploymentTouch,chooseDeploymentTarget} from '../../dist/app/ui/deploymentTouch.js';
const require=createRequire(import.meta.url),ts=require('typescript');
const session=createFreshProductionSession(JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')),17),presentation=createPresentationState(false,false);
const model=deriveBrowserRenderModel(session,presentation);presentation.selectedDeploymentUnitId=model.deployment.roster[0].id;
const deploymentTouch=createDeploymentTouch();chooseDeploymentTarget(deploymentTouch,model,presentation.selectedDeploymentUnitId,model.deployment.zoneKeys[0]);
const source=readFileSync('src/main.ts','utf8'),start=source.indexOf('function rosterEmblem'),end=source.indexOf('\n\n\nfunction modifierHtml',start);
const js=ts.transpileModule(source.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const panel=Function('model','presentation','deploymentTouch','esc','sideLabel','deploymentLocations','deploymentConfirm','deploymentFeedback','unitDescription','unitLabel',js+';return deploymentPanel(model);')(model,presentation,deploymentTouch,escapeUi,s=>s==='SOVIET'?'Soviet':'German',deploymentLocations,deploymentConfirm,deploymentFeedback,unitDescription,unitLabel);
const map='data:image/png;base64,'+readFileSync('evidence/vs2-002r-e/01-full-vs2-far.png').toString('base64');
const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EASTFRONT B1.1 static deployment review</title><style>${readFileSync('styles.css','utf8')}</style><header class="topbar"><div class="brand"><strong>EASTFRONT</strong></div><div class="turn-strip command-hud">${commandHeader(model)}</div><div class="resource-strip"><span>STATIC REVIEW</span></div></header><main class="workspace panel-open"><section class="map-card"><div class="map-toolbar"><strong>B1.1 Deployment · static fixture</strong></div><div class="map-wrap"><img alt="Unchanged D terrain evidence" src="${map}" style="width:100%;height:100%;object-fit:contain"></div></section><aside class="side-panel"><div class="command-panel-scroll">${panel}</div>${deploymentConfirm(model,presentation.selectedDeploymentUnitId,deploymentTouch)}</aside></main><footer>Static HTML. Buttons do not perform game actions. Not a browser or device acceptance capture.</footer>`;
writeFileSync('evidence/ui-visual-pass-b11/DEPLOYMENT.html',html);
