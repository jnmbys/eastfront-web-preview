import {build} from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

export async function bundleClient(root){
 const result=await build({entryPoints:{main:path.join(root,'src/main.js'),startupShell:path.join(root,'src/web/startupShell.js')},bundle:true,splitting:true,format:'esm',platform:'browser',target:'es2020',outdir:path.join(root,'bundles'),entryNames:'[name]-[hash]',chunkNames:'chunk-[hash]',metafile:true,
 plugins:[{name:'retain-local-worker-location',setup(b){b.onLoad({filter:/[\\/]local-ai[\\/]client\.js$/},async args=>({contents:fs.readFileSync(args.path,'utf8').replace("new URL('../../ai/local/worker.js', import.meta.url)","new URL('../ai/local/worker.js', import.meta.url)"),loader:'js'}));}}]});
 const index=path.join(root,'index.html');let html=fs.readFileSync(index,'utf8');
 for(const [output,meta] of Object.entries(result.metafile.outputs)){
  if(!meta.entryPoint)continue;
  for(const name of ['main','web/startupShell'])if(meta.entryPoint.replaceAll('\\','/').endsWith('/src/'+name+'.js'))html=html.replace('./src/'+name+'.js','./'+path.relative(root,output).replaceAll('\\','/'));
 }
 if(html.includes('src="./src/main.js"'))throw Error('CLIENT_BUNDLE_ENTRY_MISSING');
 fs.writeFileSync(index,html);
 console.log('Client bundled: '+Object.keys(result.metafile.inputs).length+' modules → '+Object.keys(result.metafile.outputs).length+' chunks (no game rule changes)');
}
