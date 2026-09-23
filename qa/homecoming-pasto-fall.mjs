// Replay the first two long fuzz rooms with a short history around a speed failure.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import http from 'node:http';
import { openHarness } from './reimagine-harness.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT) || 5191;
const answers = () => new Promise(resolve => {
  const req = http.get({ host: 'localhost', port, path: '/', timeout: 1000 }, res => {
    res.resume(); resolve(true);
  });
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});
if (await answers()) throw new Error('Pasto trace needs its own unused port: ' + port);
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
});
try {
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    ready = await answers();
  }
  if (!ready) throw new Error('Pasto trace server did not start');
  let source = readFileSync(new URL('./fuzz.js', import.meta.url), 'utf8');
  source = source.replace('const sysFUZZ_SEC = 8;', 'const sysFUZZ_SEC = 45;');
  source = source.replace(/const names = \['sydney',[\s\S]*?'hanoi'\];/,
    "const names = ['sydney', 'pasto'];");
  source = source.replace('http://localhost:5188/', 'http://localhost:' + port + '/');
  if (!source.includes("const names = ['sydney', 'pasto'];") ||
      source.includes('const sysFUZZ_SEC = 8;')) throw new Error('Pasto fuzz staging did not match');
  const probe = new Function('return (' + source + '\n);')();
  const harness = await openHarness({ url: 'http://localhost:' + port + '/', pinRung: false });
  try { await probe(harness.page); }
  finally { await harness.close(); }
} finally {
  server.kill();
}
