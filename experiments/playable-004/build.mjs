import{execFileSync}from'node:child_process';import{cpSync,mkdirSync}from'node:fs';
execFileSync(process.execPath,['ai/local/build.mjs'],{stdio:'inherit'});
mkdirSync('.logistics-dist',{recursive:true});
for(const d of ['src','server','ai'])cpSync('.ai003-preview/'+d,'.logistics-dist/'+d,{recursive:true});
mkdirSync('.logistics-dist/vendor/eastfront-digital-core',{recursive:true});
cpSync('experiments/industry-integrate-018/.runtime/live/core/dist','.logistics-dist/vendor/eastfront-digital-core/dist',{recursive:true});
cpSync('vendor/eastfront-digital-core/reference','.logistics-dist/vendor/eastfront-digital-core/reference',{recursive:true});
console.log('PLAYABLE-004: continuous owner, pinned 018 Core/SP and main map; old mode unchanged.');
