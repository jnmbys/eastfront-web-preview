import { copyFile, cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('index.html','dist/index.html');
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
