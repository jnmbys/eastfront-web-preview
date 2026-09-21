import {cp,mkdir} from 'node:fs/promises';
await mkdir('.server-dist/vendor/eastfront-digital-core',{recursive:true});
for (const name of ['dist','reference']) await cp(`vendor/eastfront-digital-core/${name}`,`.server-dist/vendor/eastfront-digital-core/${name}`,{recursive:true});
