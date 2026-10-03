// TLS reachability probe only: no game routes, credentials, cookies or auth substitutes.
import {createServer} from 'node:https';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash,X509Certificate} from 'node:crypto';
const cert=readFileSync('.mp010-build/mp013-test/cert.pem'),key=readFileSync('.mp010-build/mp013-test/key.pem');
const x509=new X509Certificate(cert),sockets=new Set(),errors=[];let requests=0;
const server=createServer({cert,key},(_req,res)=>{requests++;res.writeHead(503,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('MP014 TLS preflight only; no game or login started.');});
server.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
server.on('tlsClientError',e=>errors.push(e.code??'UNKNOWN'));
await new Promise((ok,fail)=>{server.once('error',fail);server.listen(4193,'127.0.0.1',ok);});
console.log('TLS-only probe https://localhost:4193; certificate validation must remain enabled. Send stop on stdin to close.');
let closing=false;async function close(){if(closing)return;closing=true;for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));mkdirSync('evidence/mp-014',{recursive:true});writeFileSync('evidence/mp-014/browser-tls-server.json',JSON.stringify({kind:'Local TLS preflight only, not authenticated acceptance',at:new Date().toISOString(),certificateSha256:createHash('sha256').update(cert).digest('hex'),subject:x509.subject,subjectAltName:x509.subjectAltName,validFrom:x509.validFrom,validTo:x509.validTo,httpRequests:requests,tlsErrorCodes:errors,certificateValidationBypassed:false,systemTrustChanged:false,gameStarted:false,publicOpened:false,listenerClosed:true},null,2)+'\n');process.exit();}
process.stdin.resume();process.stdin.on('data',()=>close());process.on('SIGINT',close);process.on('SIGTERM',close);
setTimeout(close,60000); // Bound a probe even when the caller does not provide interactive stdin.
