// Save/travel integration fixtures, not a claim these actions were earned.
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const touch = process.argv.includes('--touch');
const h = await openHarness({ story: true, ...(touch ? { width: 390, height: 844, hasTouch: true, isMobile: true } : {}) });
const out = { touch, metadata: h.metadata, checks: 0, fixture: 'task injection; public travel and reload' };
function check(ok, label) { assert(ok, label); out.checks++; }
const open = () => h.page.evaluate(() => window.__capy.gateInfo().filter(r => r.open).map(r => r.n));
const award = ids => h.page.evaluate(ids => ids.forEach(id => window.__capy.completeTask(id, true)), ids);
try {
  await h.start();
  check(await h.page.evaluate(() => window.__capy.state.journeyMode === 'story' && window.__capy.state.homecomingArc), 'Begin selects new story');
  check((await open()).join(',') === '1', 'fresh story only admits Sydney');
  await h.page.evaluate(() => window.__capy.hud.cross('hanoi'));
  await h.page.waitForTimeout(300);
  check(await h.page.evaluate(() => window.__capy.biome.current === 'sydney'), 'public crossing cannot bypass locked act');
  await award(['steal-hat']);
  check((await open()).join(',') === '1', 'support alone does not open coast');
  await award(['picnic-thief']);
  check((await open()).join(',') === '1,3,14', 'gentler Sydney memory opens coast');
  const memory = await h.page.evaluate(() => window.__capy.gateInfo(1));
  check(memory.enough && memory.need === 2 && memory.experience.alternativeDone && !memory.experience.signatureDone,
    'alternative earns memory without awarding the signature');
  await h.arrive('quay');
  await award(['under-bridge', 'take-helm']);
  check((await open()).join(',') === '1,2,3,5,6,14,15', 'second coastal memory opens company act');
  await h.page.waitForTimeout(1000);
  await h.page.reload({ waitUntil: 'load' });
  await h.page.waitForFunction(() => !!window.__capy && !!document.querySelector('.capyui-go'));
  await h.page.keyboard.press('ArrowRight');
  check(await h.page.locator('.capyui-pick:disabled').count() === 12, 'returning story title locks only later acts');
  await h.screenshot('homecoming-story-atlas');
  await h.start();
  check((await open()).join(',') === '1,2,3,5,6,14,15', 'story unlocks survive reload');
  check(await h.page.evaluate(() => window.__capy.biome.current === 'quay'), 'resume restores chosen place');
  await h.page.keyboard.press('Escape');
  await h.page.getByRole('button', { name: 'free roam: open every place', exact: true }).click();
  check((await open()).length === 19, 'explicit free-roam switch opens every place');
  check(await h.page.evaluate(() => window.__capy.gateInfo(1).enough && window.__capy.gateInfo(3).enough), 'mode switch retains earned memories');
  await h.arrive('hanoi');
  await h.page.waitForTimeout(1000);
  const save = await h.page.evaluate(() => JSON.parse(localStorage.getItem('capy3.journey.v1')));
  check(save.journeyMode === 'free' && save.arcV1 === 1 && save.tasks.includes('picnic-thief'), 'mode and memory rules persist independently');
  check(h.metadata.errors.length === 0, 'no browser errors'); out.pass = true;
} catch (e) { out.pass = false; out.failure = String(e.stack || e); process.exitCode = 1; }
finally { await h.result('homecoming-story-live-v2-' + (touch ? 'touch' : 'desktop'), out); await h.close(); console.log(JSON.stringify({ checks: out.checks, pass: out.pass, failure: out.failure, errors: h.metadata.errors })); }
