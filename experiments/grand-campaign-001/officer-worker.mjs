import {parentPort,workerData} from 'node:worker_threads';
import {officerDecision} from '../../.ai003-preview/ai/fair/officer.js';
// This worker receives fair DTOs and own public inventory only, never Campaign/Core.
try{const {input,members,order,profile,services}=workerData,start=performance.now();parentPort.postMessage({...officerDecision(input,members,order,profile,services),policyMs:performance.now()-start});}catch(e){parentPort.postMessage({error:e.message});}
