import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const files = new Set(['index.html', 'styles.css', 'app.mjs', 'view.mjs', 'demo-adapter.mjs']);
const types = { '.html': 'text/html', '.css': 'text/css', '.mjs': 'text/javascript' };
http.createServer(async (req, res) => {
  const name = new URL(req.url, 'http://127.0.0.1').pathname.slice(1) || 'index.html';
  if (!['GET', 'HEAD'].includes(req.method) || !files.has(name)) {
    res.writeHead(404).end('Not found'); return;
  }
  try {
    const data = await readFile(path.join(root, name));
    res.writeHead(200, {
      'Content-Type': `${types[path.extname(name)]}; charset=utf-8`,
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; connect-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(500).end('Local file unavailable'); }
}).listen(4173, '127.0.0.1', () => console.log('DEMO ONLY http://127.0.0.1:4173 (Ctrl+C to stop)'));
