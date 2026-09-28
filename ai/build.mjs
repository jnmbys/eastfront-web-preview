import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,[root+'node_modules/typescript/bin/tsc','-p',root+'ai/tsconfig.json'],{cwd:root,stdio:'inherit'});
// Isolated output only: never writes production dist or the frozen vendor baseline.
mkdirSync(root+'.ai-dist/vendor/eastfront-digital-core',{recursive:true});
rmSync(root+'.ai-dist/vendor/eastfront-digital-core/dist',{recursive:true,force:true});
cpSync(root+'vendor/eastfront-digital-core/dist',root+'.ai-dist/vendor/eastfront-digital-core/dist',{recursive:true});
