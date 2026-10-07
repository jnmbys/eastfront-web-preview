import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
const key=p=>{const m=p.match(/^([A-Z]+)(\d+)$/);return core.hexKey(core.paperToAxial(m[1],Number(m[2])));};
export const policy={id:'CITY-001',baseline:'3f28a575151d87829ade2bac064fadbe60284740',mapSha:'706113ecf7ffd3864d744de1b4f18fd775d5c22b',constructionI:6,constructionEpochs:2,slots:{MAIN:1,STATION:0,INDUSTRIAL:4,RESIDENTIAL:1}};
export function layout(nodes){const samples=[
 {id:'CITY-WEST-WORKS',label:'西方总部与近郊工业群',districts:[['H16','MAIN'],['I17','STATION'],['J17','INDUSTRIAL'],['H17','RESIDENTIAL']]},
 {id:'CITY-DNIEPER',label:'第聂伯枢纽与近郊',districts:[['Z17','MAIN'],['AC17','STATION'],['AB18','INDUSTRIAL'],['Z20','RESIDENTIAL']]},
 {id:'CITY-SOUTH-FERRY',label:'南部河谷渡口',districts:[['Y26','MAIN']]}
 ];const assigned=new Set(samples.flatMap(c=>c.districts.map(d=>key(d[0]))));
 for(const n of nodes)if(!assigned.has(n.hex)){samples.push({id:'CITY:'+n.id,label:n.label,districts:[[core.axialToPaper({q:Number(n.hex.split(',')[0]),r:Number(n.hex.split(',')[1])}).label,'MAIN']]});assigned.add(n.hex);}
 return samples.map(c=>({...c,districts:c.districts.map(([paper,type],i)=>({id:`${c.id}:D${i}`,cityId:c.id,paper,hex:key(paper),type,slots:policy.slots[type]}))}));
}

