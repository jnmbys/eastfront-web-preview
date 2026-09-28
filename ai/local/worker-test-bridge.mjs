/** Node Worker test adapter only. Not copied into the browser candidate. */
import {parentPort,workerData} from 'node:worker_threads';
globalThis.self={postMessage:value=>parentPort.postMessage(value),onmessage:null};
await import(workerData.entry);
parentPort.on('message',data=>self.onmessage({data}));
