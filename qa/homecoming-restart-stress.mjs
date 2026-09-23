// Three same-host load laps in one tab, keeping the actual save between reloads.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import http from 'node:http';
import { openHarness } from './reimagine-harness.mjs';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.PORT) || 5191;
const cycles = Number(process.env.CAPY_RESTART_CYCLES) || 3;
if (!Number.isInteger(cycles) || cycles < 1 || cycles > 5) throw new Error('cycles must be 1–5');
const answers = () => new Promise(resolve => {
  const req = http.get({ host: 'localhost', port, path: '/', timeout: 1000 }, res => {
    res.resume(); resolve(true);
  });
  req.on('error', () => resolve(false));
  req.on('timeout', () => { req.destroy(); resolve(false); });
});
if (await answers()) throw new Error('Restart stress needs its own unused port: ' + port);
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore',
});
try {
  let ready = false;
  for (let i = 0; i < 40 && !ready; i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    ready = await answers();
  }
  if (!ready) throw new Error('Restart stress server did not start');
  let source = readFileSync(new URL('./l6-load.js', import.meta.url), 'utf8');
  const clear = /  await page\.addInitScript\(\(\) => \{ try \{ localStorage\.clear\(\) \} catch \(e\) \{\} \}\)\r?\n/;
  if (!clear.test(source)) throw new Error('Load probe save-clear anchor moved');
  source = source.replace(clear, '');
  source = source.replace('http://localhost:5190/', 'http://localhost:' + port + '/');
  const probe = new Function('return (' + source + '\n);')();
  const harness = await openHarness({ url: 'http://localhost:' + port + '/', pinRung: false });
  const result = { at: new Date().toISOString(), cycles, runs: [], failure: null };
  try {
    for (let i = 0; i < cycles; i++) {
      console.log('restart cycle ' + (i + 1) + '/' + cycles);
      try {
        const beforeSave = await harness.page.evaluate(() => localStorage.getItem('capy3.journey.v1'));
        if (i && !beforeSave) throw new Error('previous cycle save missing before reload');
        const out = await probe(harness.page);
        const afterSave = await harness.page.evaluate(() => localStorage.getItem('capy3.journey.v1'));
        if (!afterSave) throw new Error('cycle did not leave a save');
        result.runs.push({ cycle: i + 1, pass: out.pass, rows: out.rows.length,
          returns: out.lap2.length, maxCold: Math.max(...out.rows.map(r => r.maxAfter)),
          maxWarm: Math.max(...out.lap2.map(r => r.maxAfter)), invalid: out.invalid,
          saveBeforeBytes: beforeSave?.length ?? 0, saveAfterBytes: afterSave.length });
      } catch (error) {
        result.failure = { cycle: i + 1, message: String(error.stack || error) };
        break;
      }
    }
    result.browserErrors = harness.metadata.errors;
    result.startupTail = harness.metadata.crashTrace.slice(-40);
    await harness.result('homecoming-restart-stress', result);
    if (result.failure || result.browserErrors.length || result.runs.length !== cycles ||
        result.runs.some(r => !r.pass)) throw new Error('Restart stress failed: ' +
          JSON.stringify({ failure: result.failure, errors: result.browserErrors }));
  } finally {
    await harness.close();
  }
} finally {
  server.kill();
}
