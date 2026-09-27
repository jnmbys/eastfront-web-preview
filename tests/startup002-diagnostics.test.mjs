import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setLocale} from '../dist/app/localization/index.js';
import {startupDiagnosticMarkup,bindStartupDiagnostics,startupDiagnosticReport,STARTUP_BUILD} from '../dist/app/web/startupDiagnostics.js';
import {fatalMarkup} from '../dist/app/web/preview.js';

test('STARTUP002 existing fatal page offers readable copyable safe diagnostics in both languages',()=>{
 for(const locale of ['zh-CN','en-US']){
  setLocale(locale);const markup=fatalMarkup('resource failure');
  assert(markup.includes('startup-diagnostic-copy'));assert(markup.includes('readonly'));
  assert(markup.includes('STARTUP-002'));assert(markup.includes(STARTUP_BUILD));
 }
 setLocale('zh-CN');
 assert.match(STARTUP_BUILD,/^[0-9a-f]{40}$/);
 assert.equal(STARTUP_BUILD,JSON.parse(readFileSync('dist/diagnostics/transport/build.json','utf8')).sourceCommit);
 const report=startupDiagnosticReport();assert(!('url' in report));assert(!('storage' in report));
});

test('STARTUP002 copy remains manually selectable if the device denies clipboard access',async()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');let click,selected=0,focus=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{throw new Error('denied');}}}});
 const box={value:'safe diagnostics',focus(){focus++;},select(){selected++;}},status={textContent:''};
 const root={querySelector(selector){return selector==='#startup-diagnostic-copy'?{addEventListener(_event,handler){click=handler;}}:selector==='#startup-diagnostic-text'?box:status;}};
 try{bindStartupDiagnostics(root);await click();assert.equal(selected,1);assert.equal(focus,1);assert(status.textContent.includes('复制'));assert.equal(box.value,'safe diagnostics');}
 finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
});
