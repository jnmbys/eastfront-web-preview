const fs=require('fs'),crypto=require('crypto'),path=require('path');
const d='research/ART-UI-DIRECTION-021/revision-02';
const origins={
'civ7-map.jpg':'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1295660/ss_8c1226a5c58447773b03b6c967e9d561d3315fd7.1920x1080.jpg?t=1789481137',
'civ7-official.jpg':'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1295660/6461e684c0ddb02f3058ea0a4d3d7a7eb3167759/ss_6461e684c0ddb02f3058ea0a4d3d7a7eb3167759.1920x1080.jpg?t=1789481137',
'vic3-buildings.webp':'https://images.ctfassets.net/u73tyf0fa8v1/4FX7EDGhKBmZWVWs79C283/1a61a2c25ff3ff8e987a13223f270b03/3.jpg?fm=webp&q=75&w=1920',
'vic3-outliner.webp':'https://images.ctfassets.net/u73tyf0fa8v1/4qki64uD5NgmoGAd4qXt2M/e4f127bf065606387ab1c70f719d0fb6/4.jpg?fm=webp&q=75&w=1920',
'hoi4-supply.png':'https://clan.fastly.steamstatic.com/images/9948323/c0dec3125bd2ecb337e3271c0e4d9072f2cf22a7.png'
};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['t5-before-order.png','t8-before-care.png',...Object.keys(origins).map(n=>'references/'+n)].map(p=>{
 const b=fs.readFileSync(path.join(d,p));
 return {path:p,bytes:b.length,sha256:hash(b),...(p.startsWith('references/')?{source:origins[path.basename(p)],use:'third-party research reference only, not runtime asset',visuallyInspected:true}:{width:b.readUInt32BE(16),height:b.readUInt32BE(20),use:'generated concept, not game screenshot',visuallyInspected:true})};
});
for(const f of fs.readdirSync(d))if(/\.(md|txt)$/.test(f))fs.writeFileSync(path.join(d,f),fs.readFileSync(path.join(d,f),'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n');
fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify({date:'2026-10-04',generation:{tool:'built-in image_gen',calls:2,postprocessing:'none; original generated PNGs copied',prompts:['prompt-t5.txt','prompt-t8.txt']},checkpointSource:'../verified-checkpoints.json',checkpointSha256:hash(fs.readFileSync('research/ART-UI-DIRECTION-021/verified-checkpoints.json')),files,proposalPngBytes:files.filter(x=>!x.path.startsWith('references/')).reduce((a,b)=>a+b.bytes,0),runtimeDelta:{bytes:0,canvas:0,dom:0},review:{keyStateText:'manually inspected against archived T5 v0 / T8 v37',maps:'same composition, generated detail drift; not semantic verification',interactiveTesting:'not run, no runtime modifications',performance:'unverified',acceptance:'pending user direction confirmation'}},null,2)+'\n');
console.log(JSON.stringify({files:files.length,proposalDimensions:files.slice(0,2).map(f=>[f.width,f.height]),proposalBytes:files.slice(0,2).reduce((a,b)=>a+b.bytes,0)}));
