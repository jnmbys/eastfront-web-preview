const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.join(__dirname,'dist'),evidence=path.resolve(__dirname,'../../evidence/ART-BLEND-011');
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp'};
(async()=>{await fs.mkdir(evidence,{recursive:true});const server=http.createServer(async(req,res)=>{try{let p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));assert(p.startsWith(root+path.sep));const b=await fs.readFile(p);res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Cache-Control':'public,max-age=600'});res.end(b);}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/workspace/scratch/1dc165285827/browser-runtime/chromium',args:['--no-sandbox','--disable-dev-shm-usage'],headless:true}),result={browser:browser.version(),conditions:'Local HTTP; Linux headless Chromium, 1363x936 DPR1, no CPU/network throttle, 1 cold-context trial per variant; descriptive cost only, no performance acceptance. Ready flag is not presented frame. Screenshot comparisons use same loaded document, camera and fixtures. Reuse existing host fonts; no shipped font asset.',loads:[],checks:[],errors:[],external:[]};
if(process.env.SCREENSHOTS_ONLY){
 try{const page=await browser.newPage({viewport:{width:1363,height:936},deviceScaleFactor:1});await page.goto(url);await page.waitForSelector('html[data-ready=true]');await page.evaluate(()=>document.fonts.ready);
 const views=[];for(const camera of ['medium','near']){if(camera==='medium')for(let i=0;i<8;i++)await page.locator('#zoom-out').click();else await page.locator('#focus').click();const before=await page.evaluate(()=>({view:window.sliceDebug.report().view,cell:window.sliceDebug.report().cell,units:document.querySelector('#units').innerHTML,hexes:document.querySelector('#hexes').innerHTML}));await page.screenshot({type:'jpeg',quality:93,path:path.join(evidence,'refined-'+camera+'.jpg')});await page.locator('#variant').click();await page.waitForFunction(()=>window.sliceDebug.report().variant==='baseline');await page.screenshot({type:'jpeg',quality:93,path:path.join(evidence,'current010-'+camera+'.jpg')});assert.deepEqual(await page.evaluate(()=>({view:window.sliceDebug.report().view,cell:window.sliceDebug.report().cell,units:document.querySelector('#units').innerHTML,hexes:document.querySelector('#hexes').innerHTML})),before);views.push({camera,view:before.view});await page.locator('#variant').click();await page.waitForFunction(()=>window.sliceDebug.report().variant==='candidate');}
 await fs.writeFile(path.join(evidence,'screenshot-record.json'),JSON.stringify({browser:browser.version(),viewport:[1363,936],dpr:1,reason:'Re-capture only after restoring missing host CJK font; original measured trials retained',font:'Noto Sans CJK SC Regular, host font only; not a runtime asset',views},null,2));
 }finally{await browser.close();server.close();}return;
}
try{
 for(let trial=0;trial<1;trial++)for(const variant of ['baseline','candidate']){
  const context=await browser.newContext({viewport:{width:1363,height:936},deviceScaleFactor:1}),page=await context.newPage();page.on('pageerror',e=>result.errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(url))result.external.push(r.url());});const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.clearBrowserCache');await page.goto(url+'/?variant='+variant);await page.waitForSelector('html[data-ready=true]');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const report=await page.evaluate(()=>window.sliceDebug.report());result.loads.push({trial,variant,stats:{...report.stats,placements:undefined,details:undefined},longTasks:report.longTasks,nodes:await page.locator('*').count(),resources:report.resources,view:report.view});
  if(trial===0&&variant==='candidate'){
   assert.equal(await page.locator('[data-cell]').count(),640);assert.equal(await page.locator('[data-unit-id]').count(),58);
   const baseView=await page.evaluate(()=>window.sliceDebug.report().view);for(const camera of ['medium','near']){
    if(camera==='medium')for(let i=0;i<8;i++)await page.locator('#zoom-out').click();else await page.locator('#focus').click();
    let before=await page.evaluate(()=>({view:window.sliceDebug.report().view,cell:window.sliceDebug.report().cell,selected:window.sliceDebug.report().selected,units:document.querySelector('#units').innerHTML,hexes:document.querySelector('#hexes').innerHTML}));
    await page.screenshot({type:'jpeg',quality:93,path:path.join(evidence,'refined-'+camera+'.jpg')});
    await page.locator('#variant').click();await page.waitForFunction(()=>window.sliceDebug.report().variant==='baseline');await page.screenshot({type:'jpeg',quality:93,path:path.join(evidence,'current010-'+camera+'.jpg')});
    let after=await page.evaluate(()=>({view:window.sliceDebug.report().view,cell:window.sliceDebug.report().cell,selected:window.sliceDebug.report().selected,units:document.querySelector('#units').innerHTML,hexes:document.querySelector('#hexes').innerHTML}));assert.deepEqual(after,before);result.checks.push({test:camera+' identical camera/selection/unit SVG/hit polygons',status:'PASS',view:before.view});
    await page.locator('#variant').click();await page.waitForFunction(()=>window.sliceDebug.report().variant==='candidate');
   }
   const maskResult=await page.evaluate(async()=>{
    const {clipNaturalSpace,settlementCells}=await import('./app/experiments/blend011Layout.js');
    const {createSlice,label,inside,corridors,segmentDistance}=await import('./app/experiments/mapData.js');
    const {hexToPixel,hexPolygon}=await import('./app/geometry/hex.js');
    const data=createSlice(await(await fetch('./map.json')).json()),lanes=corridors(data),checks=[];
    for(const h of data.hexes.filter(h=>settlementCells.has(label(h.coord))&&['FOREST','HILL','ROUGH'].includes(h.terrain))){
     const c=hexToPixel(h.coord),can=document.createElement('canvas');can.width=can.height=120;const ctx=can.getContext('2d');ctx.translate(60-c.x,60-c.y);clipNaturalSpace(ctx,data,h);ctx.fillRect(c.x-60,c.y-60,120,120);const a=ctx.getImageData(0,0,120,120).data;let solid=0,bad=0;
     for(let y=0;y<120;y++)for(let x=0;x<120;x++){if(a[(y*120+x)*4+3]<250)continue;solid++;const p={x:c.x+x-59.5,y:c.y+y-59.5};if(!inside(p,hexPolygon(h.coord))||lanes.some(l=>segmentDistance(p,l.a,l.b)<l.width+.45)||data.counters.some(u=>{const q=hexToPixel(u.hex);return Math.abs(q.x-p.x)<33.9&&Math.abs(q.y-p.y)<33.9;}))bad++;}
     checks.push({cell:label(h.coord),solid,bad});
    }
    const t=document.querySelector('[data-terrain-label="X14"]'),box=t.getBBox(),city=window.sliceDebug.report().stats.placements.filter(p=>p.cell==='X14');
    const roofOverlap=city.some(p=>box.x-1<p.x+p.width/2&&box.x+box.width+1>p.x-p.width/2&&box.y-1<p.y+p.height/2&&box.y+box.height+1>p.y-p.height/2);
    return {checks,label:{x:box.x,y:box.y,width:box.width,height:box.height,roofOverlap}};
   });
   for(const c of maskResult.checks){assert(c.solid>100,c.cell+' has visible terrain space');assert.equal(c.bad,0,c.cell+' mask leaves terrain/corridor/counter scope');}assert.equal(maskResult.label.roofOverlap,false);result.checks.push({test:'Natural terrain alpha masks preserve exact terrain, corridors and counter spaces',status:'PASS',details:maskResult.checks});result.checks.push({test:'X14 label bounding box clears every roof with padding',status:'PASS',details:maskResult.label});
   await page.locator('#focus').click();await page.locator('[data-unit-id="G-03"]').click();await page.locator('[data-pick="G-02"]').click();assert.equal(await page.evaluate(()=>window.sliceDebug.report().selected),'G-02');result.checks.push({test:'stack G-03 → panel G-02',status:'PASS'});
   await page.locator('[data-label="V13"]').click();assert.equal(await page.locator('#terrain-name').textContent(),'森林');result.checks.push({test:'decorated forest click ownership',status:'PASS'});
   await page.locator('[data-label="X14"]').click();assert.equal(await page.locator('#terrain-name').textContent(),'城市');result.checks.push({test:'city click and selected outline',status:'PASS'});
   const w=await page.locator('#map-wrap').boundingBox(),x=w.x+w.width*.6,y=w.y+w.height*.7;const before=await page.evaluate(()=>window.sliceDebug.report().cell);await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y+30,{steps:10});await page.mouse.up();assert.equal(await page.evaluate(()=>window.sliceDebug.report().cell),before);result.checks.push({test:'drag suppresses accidental selection',status:'PASS'});
   await fs.writeFile(path.join(evidence,'operations.json'),JSON.stringify(await page.evaluate(()=>window.sliceDebug.report()),null,2));
  }
  await context.close();
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.external,[]);result.checks.push({test:'no page errors or nonlocal requests',status:'PASS'});
}catch(e){result.failure={message:e.message,stack:e.stack};throw e;}finally{await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({checks:result.checks.length,loads:result.loads.length,failure:result.failure}));await browser.close();server.close();}})();
