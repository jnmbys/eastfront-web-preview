const {chromium}=require('playwright');const fs=require('fs'),{spawn}=require('child_process');
const cases=JSON.parse(fs.readFileSync('evidence/choices006.json'));const assert=(x,m)=>{if(!x)throw Error(m)};
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-zygote']});let results=[];
for(const name of ['three-clips','MOVING_RETREAT','ADVANCE_AFTER_COMBAT','LOSS_ALLOCATION','MOVING_BREAKTHROUGH','SECOND_ATTACK']){
 if(name!=='three-clips'&&!cases[name])continue;
 const server=spawn('python3',['serve-test006.py',name],{stdio:['ignore','pipe','pipe']});let logs='';server.stderr.on('data',x=>logs+=x);await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('server startup '+logs)),10000);server.stdout.once('data',()=>{clearTimeout(timer);ok()});server.once('exit',()=>no(Error(logs)))});
 try{const page=await browser.newPage({viewport:{width:1024,height:768}});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>window.document.querySelector('#status').textContent.includes('revision'));
 const state=()=>page.evaluate(()=>data.state);let s=await state();
 if(name==='three-clips'){for(const clip of ['prepare','isolation','restore']){await page.selectOption('#clip',clip);await page.click('#reset');await page.waitForFunction(c=>data.state.clip===c,clip);assert((await page.locator('#map polygon').count())===640,'map');assert((await page.locator('#settlement').textContent()).includes('结算'),'timing');results.push({clip,rendered:true})}await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'width');await page.screenshot({path:'evidence/browser006-mobile.png',fullPage:true});}
 else {const a=cases[name].choice;const own=s.decision_side;await page.selectOption('#viewer',own==='G'?'S':'G');await page.waitForFunction(v=>data.state.viewer===v,own==='G'?'S':'G');assert(await page.locator('#decision').isHidden(),'other side cannot see decision');await page.click('#active');await page.waitForFunction(v=>data.state.viewer===v,own);
 s=await state();const ids=Object.fromEntries(s.nodes.map(n=>[n.coord.q+','+n.coord.r,n.id]));const paper=path=>path.map(h=>ids[h.q+','+h.r]).join(' ');const rev=s.revision;
 if(a.type==='RETREAT')await page.fill('#retreats',a.retreats.map(r=>r.unitId+': '+paper(r.path)).join('\n'));
 if(a.type==='ALLOCATE_LOSSES')await page.fill('#losses',a.unitIdsByStep.join(' '));
 if(a.unitId)await page.selectOption('#choiceUnit',a.unitId);
 if(a.type==='BREAKTHROUGH')await page.fill('#choicePath',paper(a.path));
 if(a.type==='SCHWERPUNKT_ATTACK')await page.fill('#choiceTarget',paper([a.target]));
 await page.screenshot({path:'evidence/browser006-'+name+'-before.png',fullPage:true});await page.click('#choose');
 await page.waitForFunction(r=>data.state.revision===r+1,rev);const after=await state();await page.click('#retry');await page.waitForTimeout(200);assert((await state()).revision===after.revision,'duplicate');results.push({name,before:rev,after:after.revision,choice:a.type});await page.screenshot({path:'evidence/browser006-'+name+'-after.png',fullPage:true});}
 assert(!errors.length,errors.join(','));await page.close();
 }finally{server.kill();await new Promise(ok=>server.once('exit',ok))}
}
await browser.close();fs.writeFileSync('evidence/browser006.json',JSON.stringify({results},null,2));console.log(JSON.stringify(results));})().catch(e=>{console.error(e);process.exit(1)});
