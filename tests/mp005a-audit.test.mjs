import test from 'node:test';
import assert from 'node:assert/strict';
import {bytes,fields,unchangedBytes} from '../scripts/mp005a/audit.mjs';
import {verifyAliases,encodeProposal,decodeProposal} from '../scripts/mp005a/inline-view-proposal.mjs';
const message=(viewer='GERMAN',units=[{id:'own',hex:{q:0,r:0}}])=>{
  const view={viewer,hexes:[{coord:{q:0,r:0},control:null}],edges:[],units,contacts:[],lastKnown:[]};
  return {protocolVersion:2,messageType:'PLAYER_VIEW_SNAPSHOT',requestId:null,payload:{format:'snapshot-v1',matchRevision:1,serverSequence:2,resync:false,view,
    model:{playerView:structuredClone(view),hexes:structuredClone(view.hexes),edges:[],combat:null},events:[],forcedAction:null}};
};
test('MP005A accounting is UTF-8, additive and never double-counts overlapping fields',()=>{
  const m=message();m.payload.model.label='苏联 🗺';
  assert(bytes(m)>JSON.stringify(m).length);
  assert.equal(fields(m).reduce((n,r)=>n+r.bytes,0),Buffer.byteLength(JSON.stringify(m)));
  assert.equal(unchangedBytes({items:[1,2],value:'same'},{items:[1,3],value:'same'}),bytes(1)+bytes('same'));
  assert.equal(unchangedBytes(m,m),bytes(m));
});
test('MP005A proposal rejects a false alias assumption in the offline oracle',()=>{
  const m=message();m.payload.model.hexes[0].control='GERMAN';
  assert.throws(()=>verifyAliases(m));
});
test('MP005A standalone reconstruction preserves state and independent mutable objects',()=>{
  const original=message();verifyAliases(original);
  const decoded=decodeProposal(JSON.parse(JSON.stringify(encodeProposal(original))));
  assert.deepEqual(decoded,original);
  decoded.payload.model.hexes[0].control='GERMAN';decoded.payload.model.playerView.units[0].hex.q=8;
  assert.equal(decoded.payload.view.hexes[0].control,null);assert.equal(decoded.payload.view.units[0].hex.q,0);
  assert.equal(original.payload.view.units[0].hex.q,0);
});
test('MP005A no previous-view dependency survives observation loss, resync or viewer change',()=>{
  const first=message();const second=message('GERMAN',[]);second.payload.resync=true;second.payload.matchRevision=3;second.payload.serverSequence=9;
  const enemy=message('SOVIET',[{id:'soviet-own',hex:{q:1,r:0}}]);
  for(const m of [first,second,enemy,second]){
    assert.deepEqual(decodeProposal(JSON.parse(JSON.stringify(encodeProposal(m)))),m);
  }
  assert(!JSON.stringify(decodeProposal(encodeProposal(second))).includes('soviet-own'));
});
