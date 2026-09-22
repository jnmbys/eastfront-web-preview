/** OFFLINE ONLY. A proposed new wire format, never imported by src/ or server/. */
import assert from 'node:assert/strict';
export const FORMAT='snapshot-v2-inline-view';
export function verifyAliases(message){
  assert.equal(message.protocolVersion,2);
  assert.equal(message.messageType,'PLAYER_VIEW_SNAPSHOT');
  assert.equal(message.payload.format,'snapshot-v1');
  const {view,model}=message.payload;
  assert.deepEqual(model.playerView,view);
  assert.deepEqual(model.hexes,view.hexes);
  assert.deepEqual(model.edges,view.edges);
}
/** Precondition proved by server assembly + verifyAliases in the offline oracle.
 * Retain every other field, including nulls, events and decision/private UI data.
 * Encoding here does not imply that protocol 2 clients support the proposal. */
export function encodeProposal(message){
  const {playerView,hexes,edges,...model}=message.payload.model;
  return {...message,protocolVersion:3,payload:{...message.payload,format:FORMAT,model}};
}
/** Independent copies preserve the current JSON parse object-isolation semantics.
 * A real client would validate the version/format/schema before this adapter. */
export function decodeProposal(message){
  assert.equal(message.protocolVersion,3);
  assert.equal(message.payload.format,FORMAT);
  const {view,model}=message.payload;
  return {...message,protocolVersion:2,payload:{...message.payload,format:'snapshot-v1',model:{...model,
    playerView:structuredClone(view),hexes:structuredClone(view.hexes),edges:structuredClone(view.edges)}}};
}
