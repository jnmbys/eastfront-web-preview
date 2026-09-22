// Metadata only; count all continuation frames, not just the first opcode=1 frame.
export function frameMetadata(onMessage){
 let pending=Buffer.alloc(0),message=null;
 return chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=2){
  const tag=pending[0],second=pending[1],opcode=tag&15;let n=second&127,header=2;
  if(n===126){if(pending.length<4)return;n=pending.readUInt16BE(2);header=4;}
  else if(n===127){if(pending.length<10)return;n=Number(pending.readBigUInt64BE(2));header=10;}
  if(second&128)header+=4;if(pending.length<header+n)return;
  if(opcode===1||opcode===2)message={opcode,rsv1:!!(tag&64),bytes:0,frames:0};
  if((opcode===0||opcode===1||opcode===2)&&message){message.bytes+=header+n;message.frames++;if(tag&128){onMessage(message);message=null;}}
  pending=pending.subarray(header+n);
 }};
}
