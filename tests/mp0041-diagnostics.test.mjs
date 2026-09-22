import test from 'node:test';import assert from 'node:assert/strict';
import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {frameMetadata} from '../scripts/mp0041/frame-metadata.mjs';
test('MP0041 wire evidence counts continuations and ignores interleaved control frames',()=>{
 const results=[],feed=frameMetadata(m=>results.push(m));
 // Fragmented compressed text (RSV1 only on first fragment), interleaved ping,
 // continuation, then an ordinary uncompressed text message. No payload decoding.
 const raw=Buffer.from([0x41,3,1,2,3,0x89,1,0,0x80,2,4,5,0x81,1,6]);
 for(const byte of raw)feed(Buffer.from([byte]));
 assert.deepEqual(results,[{opcode:1,rsv1:true,bytes:9,frames:2},{opcode:1,rsv1:false,bytes:3,frames:1}]);
});
test('MP0041 ordinary game diagnostic is inert without explicit opt-in',()=>{
 const native=class WebSocket{},context=vm.createContext({URLSearchParams,location:{search:''},document:{currentScript:{dataset:{}},createElement(){throw Error('Default entry touched DOM');}},window:{WebSocket:native}});
 vm.runInContext(readFileSync('public/diagnostics/transport/observe.js','utf8'),context);assert.equal(context.window.WebSocket,native);
});
