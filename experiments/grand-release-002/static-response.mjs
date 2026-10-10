import {createHash} from 'node:crypto';

// Call only after visitor authorization. Revalidation avoids stale code across
// releases; private caches cannot share authenticated responses across visitors.
export function staticResponse(req,res,bytes,type){
 const etag='"'+createHash('sha256').update(bytes).digest('hex')+'"';
 const headers={'Content-Type':type,'Cache-Control':'private, no-cache','ETag':etag,'Vary':'Cookie, Accept-Encoding','X-Content-Type-Options':'nosniff'};
 if(req.headers['if-none-match']===etag){res.writeHead(304,headers);res.end();return;}
 res.writeHead(200,{...headers,'Content-Length':bytes.length});res.end(bytes);
}
