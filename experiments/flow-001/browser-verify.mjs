import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const base = process.env.FLOW_URL ?? 'http://127.0.0.1:4180';
const evidence = new URL('./evidence/',import.meta.url);
const comparison=JSON.parse(fs.readFileSync(new URL('comparison.json',evidence)));
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[],blockedRequests=[],businessRequests=[];
async function snapshot(page){return page.evaluate(async()=> (await import('/app/main.js')).flowVerificationSnapshot());}
async function phase(page, expected){for(let n=0;n<100;n++){if((await snapshot(page)).state.phase===expected)return;await page.waitForTimeout(100);}throw new Error('Phase timeout '+expected+' actual '+(await snapshot(page)).state.phase);}
async function open(size, streamlined){
    const page=await browser.newPage({viewport:size});
    page.on('pageerror', e=>{errors.push(e.message);console.log('PAGEERROR',e.message)});
    // This experiment never joins a remote room; fail if it tries business network traffic.
    page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))businessRequests.push({url:r.url(),method:r.method()});});
    page.on('websocket',w=>businessRequests.push({url:w.url(),method:'WebSocket'}));
    await page.route('**/*',r=>{if(r.request().url().startsWith(base+'/') || r.request().url().startsWith('data:'))return r.continue();blockedRequests.push(r.request().url());return r.abort();});
    await page.goto(`${base}/?flowFixture=1&flowVerify=1${streamlined?'&flow001=1':''}`);
    await page.locator('#new-game-button').click();await page.locator('#ready-button').waitFor({state:'attached',timeout:60000});
    if(await page.locator('#side-panel').getAttribute('aria-hidden')==='true') await page.locator('#panel-toggle').click();
    return page;
}
try {
    for(const streamlined of [false,true]){
        const page=await open({width:1440,height:1000},streamlined);
        if(streamlined){assert.equal(await page.locator('#flow-auto').isChecked(),false);await page.locator('#flow-auto').check();}
        let manual=0,business=0,handoffs=0;const phases=[];
        for(const row of comparison.original.trace){
            if(streamlined && row.phase.endsWith('_RECOVERY')){await phase(page,row.nextPhase);phases.push({phase:row.phase,ready:'automatic'});continue;}
            await phase(page,row.phase);
            if(row.business){
                // Original map counter activation; no test mutation API.
                await page.locator(`[data-unit-id="${row.business.unitId}"]`).press('Enter');
                if(row.business.type==='MOVE'){
                    if(await page.locator('#move-start').count())await page.locator('#move-start').click();
                    const h=row.business.path[0];await page.locator(`[data-role="move-option"][data-hex="${h.q},${h.r}"]`).click({force:true});
                    await page.locator('#move-commit').click();
                } else { await page.locator('#entrench-unit').click(); }
                business++;
                const log=(await snapshot(page)).state.actionLog;
                assert.equal(log.at(-1).action.type,row.business.type);assert.equal(log.at(-1).accepted,true);
            }
            if(row.phase==='GERMAN_ENTRENCHMENT') {
                const filename=streamlined?'refit-desktop.png':'original-desktop.png';
                await page.locator('#ready-button').scrollIntoViewIfNeeded();
                await page.screenshot({path:new URL(filename,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
            }
            await page.locator('#ready-button').click();manual++;phases.push({phase:row.phase,ready:'manual'});
            if(await page.locator('#privacy-confirm').count()){
                assert.equal(await page.locator('#eastfront-map').count(),0);
                await page.locator('#privacy-confirm').click();handoffs++;
                if(await page.locator('#side-panel').getAttribute('aria-hidden')==='true')await page.locator('#panel-toggle').click();
                if(streamlined && row.phase==='GERMAN_ENTRENCHMENT'){
                    assert.equal(await page.locator('#flow-auto').isChecked(),false);await page.locator('#flow-auto').check();
                }
            }
        }
        const state=(await snapshot(page)).state;
        assert.deepEqual(state,JSON.parse(fs.readFileSync(new URL('final-state.json',evidence))));
        results.push({mode:streamlined?'streamlined':'original',viewport:'1440x1000',manual,business,handoffs,firstTimeOptIns:streamlined?2:0,businessNetworkRequests:0,coreActions:state.actionLog.length-comparison.setupCoreActions,phases,fullStateSHA256:createHash('sha256').update(JSON.stringify(state)).digest('hex')});
        await page.close();
    }
    for(const size of [{width:1194,height:834},{width:1024,height:768}]){
        const page=await open(size,true);assert.equal(await page.locator('#flow-auto').isChecked(),false);
        await page.locator('#ready-button').click();await page.locator('#ready-button').click();await page.locator('#ready-button').click();
        await phase(page,'GERMAN_RECOVERY');await page.locator('[data-unit-id="G-I-02"]').press('Enter');
        await page.locator('#ready-button').scrollIntoViewIfNeeded();
        const width=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));assert.ok(width.document<=width.viewport);
        await page.screenshot({path:new URL(`refit-${size.width}x${size.height}.png`,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
        // Toggle-on then off within the queue window: no later automatic submit.
        await page.locator('#flow-auto').check();await page.locator('#flow-auto').uncheck();await page.waitForTimeout(700);await phase(page,'GERMAN_RECOVERY');
        await page.locator('#ready-button').click();await phase(page,'GERMAN_ENTRENCHMENT');
        await page.locator('[data-unit-id="G-I-02"]').press('Enter');await page.locator('#entrench-unit').click();
        assert.equal((await snapshot(page)).state.units['G-I-02'].entrenched,true);
        results.push({mode:'tablet refit and off-switch regression',viewport:`${size.width}x${size.height}`,horizontalOverflow:false,result:'PASS'});await page.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(blockedRequests,[]);assert.deepEqual(businessRequests,[]);
    fs.writeFileSync(new URL('browser-results.json',evidence),JSON.stringify({results,errors,blockedRequests,businessRequests,deviceAcceptance:false,note:'Edge desktop browser viewport emulation only; no physical tablet or multiplayer acceptance.'},null,2)+'\n');
    console.log(JSON.stringify(results,null,2));
} finally {await browser.close();}
