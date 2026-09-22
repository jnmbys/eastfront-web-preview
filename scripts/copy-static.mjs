import { startupLoadingMarkup } from '../dist/app/web/startupView.js';
import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
// Static localized feedback is visible before the main module graph downloads.
await writeFile('dist/index.html',(await readFile('index.html','utf8')).replace('<!--startup-feedback-->',startupLoadingMarkup()));
await copyFile('styles.css','dist/styles.css');
await mkdir('dist/vendor/eastfront-digital-core', { recursive:true });
await cp('vendor/eastfront-digital-core/dist','dist/vendor/eastfront-digital-core/dist',{recursive:true});
await cp('vendor/eastfront-digital-core/reference','dist/vendor/eastfront-digital-core/reference',{recursive:true});
await copyFile('vendor/eastfront-digital-core/BASELINE_SHA256.txt','dist/vendor/eastfront-digital-core/BASELINE_SHA256.txt');
await mkdir('dist/assets/terrain', { recursive:true });
await cp('public/assets/terrain/p4r3','dist/assets/terrain/p4r3',{recursive:true});
// VS2 stays in its own namespace; preserve Painter file paths and bytes.
await cp('public/assets/terrain/vs2-002','dist/assets/terrain/vs2-002',{recursive:true});
// tsc reformats imported JSON; restore the authoritative manifest bytes.
await copyFile('src/assets/VS2_ASSET_MANIFEST.json','dist/app/assets/VS2_ASSET_MANIFEST.json');

// Multiplayer config is explicit for static hosting; no production localhost fallback.
await copyFile('multiplayer.css','dist/multiplayer.css');
await writeFile('dist/multiplayer-config.json',JSON.stringify({serverUrl:process.env.MULTIPLAYER_SERVER_URL??''},null,2)+'\n');

// Optional, safe transport diagnostics; default entry does not instrument sockets.
await cp('public/diagnostics/transport','dist/diagnostics/transport',{recursive:true});
const {execFileSync}=await import('node:child_process');
let sourceCommit='unverified';
try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{/* Source ZIPs can still build; never claim an unverified version. */}
await writeFile('dist/diagnostics/transport/build.json',JSON.stringify({sourceCommit})+'\n');
