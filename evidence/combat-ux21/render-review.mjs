// Static component review only: actual compiled panel, counters and CSS.
// Run after npm run build from the repository root.
import {readFileSync,writeFileSync} from 'node:fs';
import {unit,fixture} from '../../tests/helpers/combat-fixture.mjs';
import {selectCounter} from '../../dist/app/interaction/intents.js';
import {setLocale} from '../../dist/app/localization/index.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../../dist/app/render/coreSvg.js';
import {combatAttackPanel} from '../../dist/app/ui/combatAttackPanel.js';
const {s,p}=fixture(17,[unit('G-PZ-01','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('G-I-01','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),unit('G-J-01','G-JAGER','GERMAN','JAGER',{q:1,r:-1}),unit('G-I-02','G-INF','GERMAN','INFANTRY',{q:1,r:0}),unit('S-EL-01','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0})]);
for(const id of ['G-PZ-01','S-EL-01','G-I-01','G-J-01'])selectCounter(s,p,id);
const css=readFileSync('styles.css','utf8');
for(const locale of ['zh-CN','en-US']){
 setLocale(locale);const model=deriveBrowserRenderModel(s,p);model.hexes=model.hexes.filter(h=>Math.abs(h.coord.q)<=2&&Math.abs(h.coord.r)<=2);
 const svg=coreSvgMarkup(model,{debug:false,rendererMode:'prototype'});
 const panel=combatAttackPanel(model,'');
 const html=`<!doctype html><html lang="${locale}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>EASTFRONT UX2.1 — component review</title><style>${css}</style><body style="overflow:auto"><p style="padding:12px">UX2.1 · Static component review · ${locale} · prototype terrain fixture</p><div style="display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;padding:12px"><div class="map-wrap" style="height:660px">${svg}</div><aside class="side-panel">${panel}</aside></div></body></html>`;
 writeFileSync(`evidence/combat-ux21/preview-${locale}.html`,html.split("\n").map(line=>line.trimEnd()).join("\n").trimEnd()+"\n");
}
