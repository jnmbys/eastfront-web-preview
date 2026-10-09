// Optional presentation transport only. Authorization/delta bases are unchanged.
export const MAX_STATE_BYTES=4*1024*1024;
export function canDecodeState(){return typeof DecompressionStream==='function'&&typeof atob==='function';}
export async function decodeStateEnvelope(envelope){
 const start=performance.now(),wireBytes=new TextEncoder().encode(JSON.stringify(envelope)).length;
 if(envelope.type!=='STATE_GZIP')return {message:envelope,wireBytes,decodeMs:0};
 const n=envelope.rawBytes;
 if(!Number.isSafeInteger(n)||n<1||n>MAX_STATE_BYTES||typeof envelope.data!=='string'||envelope.data.length>MAX_STATE_BYTES*1.4)throw Error('STATE_ENCODING_SIZE');
 const bytes=Uint8Array.from(atob(envelope.data),c=>c.charCodeAt(0));
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>n)throw Error('STATE_ENCODING_SIZE');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}finally{reader.releaseLock();}
 if(total!==n)throw Error('STATE_ENCODING_SIZE');
 const raw=new Uint8Array(total);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
 const message=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(message.type!=='STATE'||message.instanceId!==envelope.instanceId||message.connectionEpoch!==envelope.connectionEpoch)throw Error('STATE_ENCODING_ENVELOPE');
 return {message,wireBytes,decodeMs:performance.now()-start};
}
