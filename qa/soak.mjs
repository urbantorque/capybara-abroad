// ===========================================================================
// npm run soak — THE SOAK IS A TEST (L6, E8 / qa F5)
//
// Everything under `npm test` answers without a browser, and the file says so
// in its own header: what it cannot do is BOOT the game. The three probes that
// do — the fuzz (random keys in nineteen chapters), the one-file build from
// file:// (qa/l4-ks.js) and the crossing's frame time (qa/l6-load.js) — were
// run by hand, and each overwrote its own JSON: the fuzz had once regressed to
// nineteen rows against the title card and nobody could have known, because
// there was nothing to compare with.
//
// This runs the three under playwright-cli, in its own session (`-s=soak`;
// never close-all, which is global and kills whatever else is open), and
// appends ONE LINE to qa/soak-history.jsonl: the commit, the date, and per
// chapter the fuzz's maxSpeed and solver saves, the crossing's longest frame
// (whole, and after the white came off) and the draw calls. qa/soak-diff.mjs
// reads that file back and exits non-zero when a column has moved more than
// 30 % against the median of the last three rows; `npm test` prints it as a
// report, because a check that needs history it may not have must not be
// able to fail a build on an empty file.
//
// The probes carry their own port and one carries an absolute path to dist/;
// they are copied to qa/.soak/ with both rewritten to this run's, so a probe
// is edited in one place and the soak follows. A server is started if nothing
// answers on the port (and stopped after); `node build.mjs` runs first since
// the file:// probe opens dist/. About six minutes on the Arc.
//
//   PORT=5188 npm run soak      the port the probes are run against (5188)
//   SOAK_SKIP=ks npm run soak   skip a probe by name (fuzz, ks, load)
// ===========================================================================
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import http from 'node:http';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5188;
const SKIP = new Set((process.env.SOAK_SKIP || '').split(',').map(s => s.trim()).filter(Boolean));
const SESSION = 'soak';
const HISTORY = join(ROOT, 'qa', 'soak-history.jsonl');
const TMP = join(ROOT, 'qa', '.soak');
const PW = process.platform === 'win32' ? 'playwright-cli.cmd' : 'playwright-cli';

const PROBES = [
  // name    source              JSON the probe writes (via /shot)
  ['fuzz', 'qa/fuzz.js',    'qa/fuzz.json.png'],
  ['ks',   'qa/l4-ks.js',   'qa/l4-ks.json.png'],
  ['load', 'qa/l6-load.js', 'qa/l6-load.json.png'],
];

function log(s) { process.stdout.write(s + '\n'); }
function sh(cmd, args, opts) {
  const r = spawnSync(cmd, args, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts || {}));
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}
// playwright-cli is a .cmd shim on Windows and needs a shell; node and git do
// not, and a shell would split process.execPath at the space in "Program Files".
function pw(args) {
  const all = ['-s=' + SESSION].concat(args);
  if (process.platform !== 'win32') return sh(PW, all);
  // One string for the shell (node warns about an args array under shell:true);
  // nothing here carries a space except the staged filename, which is quoted.
  return sh(PW + ' ' + all.map(a => /\s/.test(a) ? '"' + a + '"' : a).join(' '), [], { shell: true });
}
function answers(port) {
  return new Promise(res => {
    const rq = http.get({ host: 'localhost', port, path: '/', timeout: 1500 }, r => { r.resume(); res(true); });
    rq.on('error', () => res(false));
    rq.on('timeout', () => { rq.destroy(); res(false); });
  });
}
function readJson(rel) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { return null; }
}
function fresh(rel, since) {
  const p = join(ROOT, rel);
  return existsSync(p) && statSync(p).mtimeMs >= since;
}

const t0 = Date.now();
const commit = (sh('git', ['rev-parse', '--short', 'HEAD']).out || '').trim() || 'nogit';
const dirty = (sh('git', ['status', '--porcelain', '--', 'src', 'index.html']).out || '').trim() ? '+' : '';
log('soak  ' + commit + dirty + '  port ' + PORT);

// ---- the build, so the file:// probe has a file -----------------------------
if (!SKIP.has('ks')) {
  const b = sh(process.execPath, ['build.mjs']);
  if (b.code !== 0) { log(b.out.split('\n').slice(-8).join('\n')); log('build failed — the soak needs dist/'); process.exit(2); }
  log('built dist/');
}

// ---- a server, if there is not one --------------------------------------------
let server = null;
if (!(await answers(PORT))) {
  server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 40 && !up; i++) { await new Promise(r => setTimeout(r, 250)); up = await answers(PORT); }
  if (!up) { log('no server answered on ' + PORT + ' and one could not be started'); process.exit(2); }
  log('started server.mjs on ' + PORT);
} else log('server already on ' + PORT);

// ---- the probes, rewritten to this run's port and path ------------------------
mkdirSync(TMP, { recursive: true });
const distPath = join(ROOT, 'dist', 'untitled-capybara-game.html');
const distUrl = pathToFileURL(distPath).href;
function stage(src) {
  let code = readFileSync(join(ROOT, src), 'utf8');
  code = code.replace(/http:\/\/localhost:\d+/g, 'http://localhost:' + PORT);
  code = code.replace(/file:\/\/\/[^'"]*untitled-capybara-game\.html/g, distUrl);
  const out = join(TMP, src.split('/').pop());
  writeFileSync(out, code);
  return out;
}

const results = {};
let opened = false;
try {
  const o = pw(['open', 'http://localhost:' + PORT + '/']);
  opened = o.code === 0;
  if (!opened) { log(o.out.split('\n').slice(-6).join('\n')); log('playwright-cli could not open a page'); process.exit(2); }
  for (const [name, src, json] of PROBES) {
    if (SKIP.has(name)) { log('skip  ' + name); results[name] = { skipped: true }; continue; }
    const file = stage(src);
    const since = Date.now();
    const r = pw(['run-code', '--filename=' + file]);
    const data = fresh(json, since) ? readJson(json) : null;
    const threw = /Error|error:/i.test(r.out) && r.code !== 0;
    results[name] = { code: r.code, threw, data, stale: !data };
    log((r.code === 0 && data ? 'pass  ' : 'FAIL  ') + name.padEnd(6) + src.padEnd(16) +
        ((Date.now() - since) / 1000).toFixed(0) + ' s' + (data ? '' : '  (no fresh ' + json + ')'));
    if (r.code !== 0) log(r.out.split('\n').filter(Boolean).slice(-6).map(l => '        ' + l).join('\n'));
  }
} finally {
  if (opened) pw(['close']);
  if (server) server.kill();
}

// ---- one line of history --------------------------------------------------------
const chapters = {};
const fz = results.fuzz && results.fuzz.data;
if (fz && fz.res) for (const n in fz.res) {
  const r = fz.res[n];
  chapters[n] = Object.assign(chapters[n] || {}, { maxSpeed: r.maxSpeed, saves: r.solverSaves, nan: r.nanFrames, void: r.belowVoid });
}
const ld = results.load && results.load.data;
if (ld && ld.rows) for (const r of ld.rows) {
  chapters[r.biome] = Object.assign(chapters[r.biome] || {}, { longest: r.maxGap, after: r.maxAfter, progAfter: r.progAfter, calls: r.calls, tris: r.tris });
}
if (ld && ld.lap2) for (const r of ld.lap2) {
  chapters[r.biome] = Object.assign(chapters[r.biome] || {}, { longest2: r.maxGap });
}
const ks = results.ks && results.ks.data;
const row = {
  commit: commit + dirty, date: new Date().toISOString(), ms: Date.now() - t0, port: PORT,
  ok: {
    fuzz: !!(fz && fz.pass === true),
    ks: !!(ks && ks.pass === true),
    load: !!(ld && ld.rows && ld.rows.every(r => r.ok && !r.lastError)),
  },
  skipped: Array.from(SKIP),
  chapters,
};
appendFileSync(HISTORY, JSON.stringify(row) + '\n');
log('history  +1 row -> qa/soak-history.jsonl  (' + (row.ms / 1000 / 60).toFixed(1) + ' min)');

// ---- and the diff, as a report ----------------------------------------------------
const d = sh(process.execPath, ['qa/soak-diff.mjs']);
log(d.out.trim());
const bad = Object.keys(row.ok).filter(k => !SKIP.has(k) && !row.ok[k]);
if (bad.length) { log('soak FAILED: ' + bad.join(', ')); process.exit(1); }
log('soak ok');
