import assert from 'node:assert/strict';
import {Campaign} from './authority.mjs';
import {construction} from '../grand-economy-002/economy.mjs';
import {command,control,site} from './fixtures.mjs';
const c=new Campaign(),s=site(c,'INFRA');command(c,{type:'ECON_BUILD',kind:'INFRA',target:s.target});construction(c);const q=c.econ.modern.queue[0],p=q.progress;assert(p>0);control(c,[s.cells[0]],'SOVIET');for(let i=0;i<12;i++)construction(c);assert.equal(q.progress,p);control(c,[s.cells[0]],'GERMAN');construction(c);assert(q.progress>p);console.log('PASS partial province loss stops, recapture resumes retained progress');
