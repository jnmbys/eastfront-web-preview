import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {bindOnce} from '../../.release-territory-preview/src/ui/bindOnce.js';
import {patchProduction} from '../../.release-territory-preview/src/ui/retainedProduction.js';
const {document,window}=parseHTML('<html><body><div id="panel"><button id="clock">继续</button><details open><summary>细节</summary><span>1</span></details></div></body></html>');
globalThis.Element=window.Element;
const panel=document.getElementById('panel'),button=document.getElementById('clock');let calls=0,last=0;
for(let i=0;i<100;i++){const next=document.createElement('div');next.innerHTML=`<button id="clock">暂停${i}</button><details><summary>细节</summary><span>${i}</span></details>`;patchProduction(panel,next);bindOnce('clock-test',document.getElementById('clock'),'click',()=>{calls++;last=i;});}
button.click();assert.equal(calls,1);assert.equal(last,99);assert.equal(button,document.getElementById('clock'));assert.equal(button.textContent,'暂停99');assert(panel.querySelector('details').hasAttribute('open'));
fs.writeFileSync('evidence/grand-ux-004-r2/retained-controls.json',JSON.stringify({scope:'synthetic DOM regression, not real touch',updates:100,clicks:1,handlersRun:calls,latestClosure:last,sameButton:true,detailsOpenRetained:true}));
console.log('Retained controls: latest handler once, identity and expansion preserved');
