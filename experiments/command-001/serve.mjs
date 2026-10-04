import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(fs.readFileSync(new URL('./BASELINES.json', import.meta.url)));
for (const [name, expected] of Object.entries(manifest.coreFiles)) {
    const actual = createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
    if (actual !== expected) throw new Error(`Frozen Core mismatch: ${name}`);
}
const port = Number(process.argv[2] ?? 4190);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
    if (req.headers.host !== `127.0.0.1:${port}` || (req.headers.origin && req.headers.origin !== `http://127.0.0.1:${port}`)) {res.writeHead(403).end();return;}
    if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
    try {
        const pathname = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname);
        const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        if (!file.startsWith(root) || pathname.split('/').some(p => p.startsWith('.')) || !fs.statSync(file).isFile()) {res.writeHead(404).end();return;}
        res.writeHead(200, {'Content-Type':types[path.extname(file)] ?? 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
    } catch {res.writeHead(404).end();}
});
server.listen(port,'127.0.0.1',() => console.log(`COMMAND-001 http://127.0.0.1:${port}/?command001=1\nFixed legal start: http://127.0.0.1:${port}/?command001=1&commandScene=1\nOriginal controls: http://127.0.0.1:${port}/?commandScene=1\nStop: Ctrl+C`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
