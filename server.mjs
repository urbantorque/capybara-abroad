// Minimal zero-dependency static server for local playtesting.
//   node server.mjs   ->  http://localhost:5173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

createServer(async (req, res) => {
  // QA capture sink: the page POSTs a base64 PNG here and we drop it on disk so it
  // can be inspected even when the browser pane is not compositing.
  if (req.method === 'POST' && req.url.startsWith('/shot')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w.-]/g, '');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const b64 = Buffer.concat(chunks).toString('utf8').replace(/^data:image\/png;base64,/, '');
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(join(ROOT, 'qa'), { recursive: true });
    await writeFile(join(ROOT, 'qa', name + '.png'), Buffer.from(b64, 'base64'));
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                         'Cache-Control': 'no-store' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + p);
  }
}).listen(PORT, () => console.log('serving http://localhost:' + PORT));
