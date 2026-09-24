// ROADMAP-TEN T4a: can the owned browser load the page at all (a load-timeout probe).
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')); }
const b = await pw.chromium.launch({ channel: 'msedge', headless: false });
const p = await b.newPage();
const t0 = Date.now();
p.on('requestfinished', r => { if (Date.now() - t0 > 8000) console.log('late', r.url()); });
p.on('requestfailed', r => console.log('failed', r.url(), r.failure()?.errorText));
try { await p.goto(process.env.CAPY_QA_URL || 'http://localhost:5191/', { waitUntil: 'load', timeout: 90000 }); console.log('load in', Date.now() - t0); }
catch (e) { console.log('ERR', e.message.split('\n')[0]); }
await b.close();
