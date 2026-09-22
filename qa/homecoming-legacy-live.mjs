// A pre-Homecoming save must not acquire new locks or lose its old memory.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const file = { v: 1, tasks: ['opera-stage', 'picnic-thief', 'steal-hat', 'to-kyoto'],
  seen: [1, 4], biome: 'kyoto', ms: 10000, yuzu: 47, owned: [], tut: 1 };
const h = await openHarness({ storage: { 'capy3.journey.v1': file } });
const out = { metadata: h.metadata, checks: 0, fixture: 'legacy save seed' };
function check(ok, why) { assert(ok, why); out.checks++; }
try {
  await h.start();
  check(await h.page.evaluate(() => window.__capy.state.journeyMode === 'free' && !window.__capy.state.homecomingArc), 'legacy retains old memory rules and free travel');
  check(await h.page.evaluate(() => window.__capy.gateInfo().filter(r => r.open).length === 19), 'all nineteen remain open');
  const sydney = await h.page.evaluate(() => window.__capy.gateInfo(1));
  check(sydney.enough && sydney.need === 3, 'old signature plus two support memory retained');
  check(await h.page.evaluate(() => window.__capy.biome.current === 'kyoto'), 'saved location restored');
  await h.arrive('monaco');
  await h.page.waitForTimeout(1000);
  const saved = await h.page.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')));
  check(saved.arcV1 === undefined && saved.journeyMode === 'free', 'legacy never silently adopts new arc');
  check(file.tasks.every(id => saved.tasks.includes(id)) && saved.yuzu >= 47, 'earned tasks and currency retained');
  check(h.metadata.errors.length === 0, 'no errors'); out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally { await h.result('homecoming-legacy-live-v1', out); await h.close(); console.log(JSON.stringify({ checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors })); }
