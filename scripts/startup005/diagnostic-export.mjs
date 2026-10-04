import {createServer} from 'node:http';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,sep,extname} from 'node:path';import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE??'playwright'),root=resolve('dist'),out=resolve(process.argv[2]);mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://127.0.0.1').pathname);if(!path.startsWith(root+sep))throw Error();res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'}[extname(path)]??'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const lifecycle={pid:process.pid,host:'127.0.0.1',port:server.address().port,startedAt:new Date().toISOString(),browserClosed:false,serverClosed:false};
writeFileSync(out+'/lifecycle.json',JSON.stringify(lifecycle,null,2)+'\n');const browser=await pw.chromium.launch({headless:true,executablePath:process.env.STARTUP003_CHROMIUM});
let page;const errors=[];
try{
 page=await browser.newPage({viewport:{width:1302,height:607},deviceScaleFactor:2.125,acceptDownloads:true});page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(`http://127.0.0.1:${server.address().port}/index.html?startupDiag=1`);await page.locator('#new-game-button').click();await page.locator('#eastfront-map').waitFor();
 const camera=[];
 const snap=async label=>{const d=await page.evaluate(async()=>(await import('/app/web/startupDiagnostics.js')).startupDiagnosticReport());camera.push({label,camera:d.terrainBuild.camera,ready:d.terrainBuild.pipeline.ready});return d.terrainBuild.camera;};
 await page.locator('#panel-toggle').click();for(let n=0;n<30;n++)await page.locator('#zoom-in').click();assert.equal((await snap('collapsed-max')).zoom,2.7);
 await page.locator('#panel-toggle').click();for(let n=0;n<30;n++)await page.locator('#zoom-in').click();assert.equal((await snap('expanded-max')).zoom,3.4);
 await page.locator('#panel-toggle').click();await page.locator('#zoom-in').click();assert.equal((await snap('collapse-and-plus-preserves-existing-zoom')).zoom,3.4);
 await page.locator('#zoom-reset').click();assert.equal((await snap('fit')).zoom,1);
 const panel=page.locator('#startup-diagnostic-save').locator('..');await panel.locator('summary').click();console.log('diagnostic panel opened');
 const exports=[];for(let i=0;i<2;i++){
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#startup-diagnostic-save').click()]);const file=out+`/export-${i}.json`;await download.saveAs(file);const data=JSON.parse(readFileSync(file));assert(data.terrainBuild.pipeline);assert(data.terrainBuild.active.length<=4);assert(data.terrainBuild.recent.length<=12);assert.deepEqual(JSON.parse(await page.locator('#startup-diagnostic-text').inputValue()),data);exports.push(data);await page.waitForTimeout(1000);
 }
 assert(exports[1].terrainBuild.sampledAt>exports[0].terrainBuild.sampledAt);assert(exports[1].terrainBuild.camera.zoom>=1);
 await page.screenshot({path:out+'/diagnostic-panel.png',fullPage:true});writeFileSync(out+'/result.json',JSON.stringify({pass:true,camera,freshAtEachClick:true,downloadAndTextareaEqual:true,query:'startupDiag=1',actualDevice:false,times:exports.map(e=>e.terrainBuild.sampledAt)},null,2)+'\n');console.log('fresh JSON download and camera panel-change PASS');
}catch(error){writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),errors,html:await page?.locator('#startup-diagnostic-save').evaluate(e=>e.outerHTML).catch(()=>null),text:await page?.locator('#startup-diagnostic-text').inputValue().catch(()=>null)},null,2)+'\n');if(page)await page.screenshot({path:out+'/failure.png',fullPage:true});throw error;}
finally{await browser.close();lifecycle.browserClosed=true;server.closeAllConnections();await new Promise(r=>server.close(r));lifecycle.serverClosed=true;lifecycle.closedAt=new Date().toISOString();writeFileSync(out+'/lifecycle.json',JSON.stringify(lifecycle,null,2)+'\n');}
