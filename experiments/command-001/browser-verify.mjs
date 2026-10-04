import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL,fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.COMMAND_URL??'http://127.0.0.1:4190',evidence=new URL('./evidence/',import.meta.url);
const rules=JSON.parse(fs.readFileSync(new URL('rules-comparison.json',evidence))),errors=[],requests=[],results=[];
const browser=await chromium.launch({channel:'msedge',headless:true});
async function snapshot(page){return page.evaluate(async()=>(await import('/app/main.js')).commandVerificationSnapshot());}
async function until(page,predicate){for(let i=0;i<100;i++){if(predicate(await snapshot(page)))return;await page.waitForTimeout(100);}throw new Error('State did not reach expected point');}
async function run(candidate,viewport,shots){
    const page=await browser.newPage({viewport,reducedMotion:'reduce'}),log=[];
    page.on('pageerror',e=>{errors.push(e.message);console.log(e.message);});
    page.on('websocket',w=>requests.push(w.url()));
    page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))requests.push(r.url());});
    await page.route('**/*',r=>r.request().url().startsWith(base+'/')||r.request().url().startsWith('data:')?r.continue():r.abort());
    async function act(selector,label,category='business',options={}){
        const el=page.locator(selector).first();await el.waitFor({state:'attached'});
        const scroll=await el.evaluate(el=>{const r=el.getBoundingClientRect();let p=el.parentElement;while(p){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowY)){const b=p.getBoundingClientRect();if(r.top<b.top||r.bottom>b.bottom)return true;}p=p.parentElement;}return r.top<0||r.bottom>innerHeight;});
        if(scroll){await el.scrollIntoViewIfNeeded();log.push({kind:'reveal-scroll',label,category});}
        if(options.key)await el.press(options.key);else await el.click(options);
        log.push({kind:options.key?'keyboard-activation':'click',label,category});
    }
    async function shot(name){if(shots)await page.screenshot({path:fileURLToPath(new URL(name,evidence))});}
    await page.goto(`${base}/?commandScene=1&commandVerify=1${candidate?'&command001=1':''}`);
    await act('#new-game-button','进入同一 T9 起点','entry');await page.locator('#ready-button').waitFor({state:'attached',timeout:60000});
    if(await page.locator('#side-panel').getAttribute('aria-hidden')==='true')await act('#panel-toggle','展开操作区','navigation');
    assert.deepEqual((await snapshot(page)).state,JSON.parse(fs.readFileSync(new URL('start-state.json',evidence))));
    if(candidate){
        await act('[data-unit-id="G-I-01"]','G-I-01 加入计划','plan',{modifiers:['Shift']});
        await act('[data-unit-id="G-I-02"]','G-I-02 加入计划','plan',{modifiers:['Shift']});
        await act('#command-target','开始标记目标','plan');await act('[data-command-hex="3,4"]','地图标记目标 3,4','plan');
        assert.deepEqual((await snapshot(page)).plan.members,['G-I-01','G-I-02']);
        await shot(`command-plan-${viewport.width}.png`);
    }
    const select=id=>act(candidate?`[data-command-unit="${id}"]`:`[data-unit-id="${id}"]`,`选中 ${id}`,'navigation',candidate?{}:{key:'Enter'});
    await select('G-I-01');await act('#move-start','选择移动路径');
    await act('[data-role="move-option"][data-hex="2,4"]','移动至 2,4');await act('#move-commit','确认移动');
    await until(page,x=>x.state.units['G-I-01'].hasMoved);
    await act('#ready-button','完成移动阶段','phase');
    for(let n=0;n<2;n++){
        const id=['G-I-01','G-I-02'][n];await select(id);
        await act('[data-unit-id="S-I-01"]','选择同一攻击目标','navigation',{key:'Enter'});
        await act('#attack-declare',`确认 ${id} 攻击`);
        await until(page,x=>x.state.pendingDecision?.kind==='RETREAT');
        assert.equal((await snapshot(page)).state.pendingDecision.unitIds[0],id);
        if(candidate){assert.equal(await page.locator('#command-target').isDisabled(),true);assert.equal(await page.locator('#ready-button').count(),0);if(n===0)await shot(`command-pending-${viewport.width}.png`);}
        const h=rules.business.retreats[n];await act(`[data-role="retreat-option"][data-hex="${h.q},${h.r}"]`,`${id} 撤退到 ${h.q},${h.r}`,'pending');
        await until(page,x=>x.state.pendingDecision===null);
    }
    await select('G-I-01');
    const final=await snapshot(page);assert.deepEqual(final.state,JSON.parse(fs.readFileSync(new URL('final-state.json',evidence))));
    if(candidate){assert.deepEqual(final.plan.target,{q:3,r:4});assert.match(await page.locator('#command-map-note').innerText(),/实际撤退/);assert.match(await page.locator('.command-next').innerText(),/已攻击/);}
    await shot(`${candidate?'command-result':'original-result'}-${viewport.width}.png`);
    const activations=log.filter(x=>x.kind!=='reveal-scroll');
    const result={mode:candidate?'candidate':'original',viewport,activations:activations.length,planActivations:activations.filter(x=>x.category==='plan').length,revealScrolls:log.filter(x=>x.kind==='reveal-scroll').length,coreActions:final.state.actionLog.length-rules.start.acceptedReplayActions,fullStateSHA256:createHash('sha256').update(JSON.stringify(final.state)).digest('hex'),log};
    if(candidate){
        const before=JSON.stringify(final.state);await act('#command-origin','调整计划主攻起点','extra-check');await act('[data-command-hex="1,4"]','主攻起点 1,4','extra-check');
        await act('#command-target','修改计划目标','extra-check');await act('[data-command-hex="4,4"]','新目标 4,4','extra-check');assert.deepEqual((await snapshot(page)).plan.target,{q:4,r:4});
        await act('#command-clear','取消计划','extra-check');assert.equal((await snapshot(page)).plan.target,null);assert.equal(JSON.stringify((await snapshot(page)).state),before);
        result.editCancelWithoutStateMutation=true;
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);result.horizontalOverflow=false;
    }
    result.log=log.filter(x=>x.category!=='extra-check');results.push(result);await page.close();
}
try{
    await run(false,{width:1440,height:1000},true);
    await run(true,{width:1440,height:1000},true);
    await run(true,{width:1194,height:834},false);
    await run(true,{width:1024,height:768},true);
    const persistence=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await persistence.goto(`${base}/?command001=1&commandScene=1&commandVerify=1`);await persistence.locator('#new-game-button').click();await persistence.locator('#ready-button').waitFor({timeout:60000});
    await persistence.locator('[data-unit-id="G-I-01"]').click({modifiers:['Shift']});await persistence.locator('#command-target').click();await persistence.locator('[data-command-hex="3,4"]').click();
    for(let n=0;n<4;n++)await persistence.locator('#ready-button').click();
    assert.equal(await persistence.locator('#eastfront-map').count(),0);await persistence.locator('#privacy-confirm').click();
    assert.equal((await snapshot(persistence)).plan.target,null);assert.equal(await persistence.locator('[data-command-unit="G-I-01"]').count(),0);
    for(let n=0;n<5;n++)await persistence.locator('#ready-button').click();
    assert.equal(await persistence.locator('#eastfront-map').count(),0);await persistence.locator('#privacy-confirm').click();
    const restored=await snapshot(persistence);assert.equal(restored.state.turn,10);assert.deepEqual(restored.plan.target,{q:3,r:4});assert.deepEqual(restored.plan.members,['G-I-01']);
    results.push({mode:'actual turn handoff and plan persistence',privacyMapRemoved:true,otherControllerPlanHidden:true,restoredTurn:10,result:'PASS'});await persistence.close();
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    fs.writeFileSync(new URL('browser-comparison.json',evidence),JSON.stringify({results,errors,businessNetworkRequests:requests.length,limits:'Edge viewport emulation; no physical device or timed human comprehension study. Click/Enter totals include plan markers and entry; reveal scrolls listed separately.'},null,2)+'\n');
    console.log(JSON.stringify(results.map(({log,...r})=>r),null,2));
}finally{await browser.close();}
