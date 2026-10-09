import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const path='experiments/grand-ui-003-r1/camera.generated.mjs';
const source=readFileSync('tests/camera-interaction.test.mjs','utf8').replaceAll('../dist/app/','../../.release-territory-preview/src/').replace('grandPort:null,','grandPort:null,grandArt:false,').replace('const wrap={classList:', 'const wrap={style:{setProperty(){}},classList:');
try{writeFileSync(path,source);const result=spawnSync(process.execPath,['--test',path],{encoding:'utf8'});writeFileSync('evidence/grand-ui-003-r1/camera-check.txt',result.stdout+result.stderr);process.stdout.write(result.stdout+result.stderr);process.exitCode=result.status;}finally{unlinkSync(path);}
