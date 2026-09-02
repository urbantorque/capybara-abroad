// Minimal zero-dependency static server for local playtesting.
//   node server.mjs   ->  http://localhost:5173
import { createServer } from 'node:http';
import { gzip as gzipCb } from 'node:zlib';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const gzip = promisify(gzipCb);

const ROOT = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
                // The QA sink writes PNGs into qa/ and the whole point is to be
                // able to look at them; served as octet-stream the browser
                // downloads them instead of showing them.
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon', '.txt': 'text/plain', '.md': 'text/markdown',
                '.map': 'application/json' };

const srv = createServer(async (req, res) => {
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

  // ONE MALFORMED URL USED TO KILL THE SERVER. decodeURIComponent throws
  // URIError on a stray percent — `GET /%zz` — and thrown from inside this
  // async handler that is an unhandled rejection, which Node 15 and later turn
  // into process exit. A browser extension or a port scanner sends one
  // eventually, and the playtest it ends is not obviously the server's fault.
  let p;
  try {
    p = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 bad url');
    return;
  }
  if (p === '/') p = '/index.html';
  const file = join(ROOT, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  // ...AND SAY OUT LOUD THAT THE FILE HAS TO BE UNDER ROOT. Today it always is,
  // because `p` starts with '/' and normalize() clamps a leading `..` off an
  // absolute path — but that is a property of the input, not a rule this file
  // states, and the `../` strip above suggests it was not what anybody was
  // relying on. One comparison, and the guarantee stops being accidental.
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403');
    return;
  }
  try {
    const buf = await readFile(file);
    const type = TYPES[extname(file)] || 'application/octet-stream';
    // ---- GZIP, FOR THE ONE FILE THAT NEEDS IT ---------------------------
    // The built artefact is a single 5.5 MB HTML file and it is almost all
    // JavaScript, which compresses to about a fifth of that. A dev server
    // does not have to care — but this is also the only server in the repo,
    // it is what anybody trying the game will run, and the difference
    // between a five megabyte download and a one megabyte one over a phone
    // is the difference between somebody playing it and not.
    //
    // TEXT ONLY, and only when the client actually asked. An image or a font
    // is already compressed and gzipping it costs CPU to make it very
    // slightly larger; a client that did not send Accept-Encoding may not be
    // sent an encoding it did not ask for.
    //
    // Vary: Accept-Encoding is not optional even here. Without it a cache in
    // front of this — a browser's own, a corporate proxy — is entitled to
    // serve the gzipped bytes to a client that cannot read them.
    const wantsGz = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
    const compressible = /^(text\/|application\/(javascript|json))/.test(type);
    if (wantsGz && compressible && buf.length > 1024) {
      const gz = await gzip(buf, { level: 6 });
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store',
                           'Content-Encoding': 'gzip',
                           'Vary': 'Accept-Encoding',
                           'Content-Length': gz.length });
      res.end(gz);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store',
                         'Vary': 'Accept-Encoding' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + p);
  }
});

// A PORT IN USE IS THE ORDINARY CASE, NOT A CRASH. Without a listener for this,
// node throws the 'error' event as an uncaught exception and prints a stack
// trace with `EADDRINUSE` somewhere in the middle of it — which is a confusing
// way to say "the server you already started is still running". Measured: it
// happened during this repo's own QA runs.
srv.on('error', (e) => {
  if (e && e.code === 'EADDRINUSE') {
    console.error(`port ${PORT} is already in use — something is serving there already.`);
    console.error(`Use it, or pick another:  PORT=${PORT + 1} node server.mjs`);
    process.exit(1);
  }
  throw e;
});
srv.listen(PORT, () => console.log('serving http://localhost:' + PORT));
