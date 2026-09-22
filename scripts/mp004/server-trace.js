// Local diagnostic runtime only. Never stores a payload, name, token, unit or hex.
export const spans=[],sends=[];
let parent=null,serial=0;
export const trace={
 begin(name){const id=++serial,up=parent,start=performance.now();parent=id;return()=>{parent=up;spans.push({id,parent:up,name,start,ms:performance.now()-start});};},
 send(message,bufferedBefore){const start=performance.now(),text=JSON.stringify(message),serialized=performance.now();const p=message.payload;
  const row={type:message.messageType,requestId:message.messageType==='ACTION_ACCEPTED'?message.requestId:undefined,revision:p.matchRevision,sequence:p.serverSequence,viewer:p.view?.viewer,start,serializeMs:serialized-start,sendCalled:serialized,bytes:Buffer.byteLength(text),bufferedBefore};
  sends.push(row);return{text,complete(bufferedAfter,error){row.sendCallback=performance.now();row.bufferedAfter=bufferedAfter;row.error=error;}};
 }
};
