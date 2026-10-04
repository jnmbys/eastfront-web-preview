const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir='research/ART-UI-DIRECTION-021';
const commits={art015:'35e36314b61e157be016040d91d9d05eeaf39f5a',art017:'754da7cdfb7a343f51d7a008cec921c4dbd9d0fa',layout020:'2aa9a655e2906667929f3828d4dd6f58d7286ea2',ui006:'75183910f524c87d9a6db3fafee27f3a2e189691',backend018:'0f31196d998fb9be8e27e2183161fb4cec0f01e1'};
const origins={
'references/art015-x14-real.jpg':['art015','evidence/ART-MAP-015/015-x14-near.jpg','real art viewer, 500%, not T5/T8 troops'],
'references/art017-sample-real.jpg':['art017','evidence/ART-EXPANSION-017/017-west-500.jpg','real render of synthetic 60-cell sample'],
'references/ui006-t5-original.png':['ui006','experiments/industry-ui-001/evidence-006/T5-start-desktop.png','real T5 before allocation and order'],
'references/ui006-t8-committed-waiting-original.png':['ui006','experiments/industry-ui-001/evidence-006/T8-committed-waiting-tablet.png','after CARE commit, fault test; NOT pre-care']
};
let attachments=[];
for(const sub of ['references','proposals']) for(const name of fs.readdirSync(path.join(dir,sub))){
 const p=sub+'/'+name,b=fs.readFileSync(path.join(dir,p)),o=origins[p];
 attachments.push({path:p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),...(o?{sourceCommit:commits[o[0]],sourcePath:o[1],sourceUrl:'https://github.com/jnmbys/eastfront-web-preview/blob/'+commits[o[0]]+'/'+o[1],classification:o[2]}:{classification:name==='t5-first.png'?'intermediate generated proposal; superseded':'final generated proposal, not real gameplay'})});
}
const out={task:'ART-UI-DIRECTION-021',date:'2026-10-04',commits,ui006Tree:'84548c4044a47b7fcf101b11ec2a1fbca774fb3f',verifiedUi006GitBlobs:{'CHAIN-018.md':'2e4aaf0712a5082f8076230176d56d76e6ffa229','chain-view.mjs':'cd012e2f7f35aa80a2a5486e8771bef3d4d07c72','evidence-006/BROWSER.json':'b8e986e1ffb792b40fd612924bb74172dcd5c0d9','evidence-006/T5-start-desktop.png':'68cd94493dbc2d7d2c04a12d5a0de1a7b6a4a12d','evidence-006/T8-committed-waiting-tablet.png':'0fe90aa06c9f0ed835263090398cd8b2998018b7'},generation:{tool:'built-in image_gen',calls:3,sequence:['T5 three local real references','T5 targeted label correction','T8 edit of corrected T5'],prompts:['prompt-t5.txt','prompt-t5-correction.txt','prompt-t8.txt'],postprocessing:'none; copied original generated PNGs',limitations:'fine coordinate and unit label drift; source data remains authoritative'},attachments};
fs.writeFileSync(path.join(dir,'sources.json'),JSON.stringify(out,null,2)+'\n');
