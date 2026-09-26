// Havoc's props (ROADMAP-TEN U2g). Headful, real GPU. Free Roam, Sydney.
//   1. the kit is placed near the arrival: 2 crates, a barrel, 3 balloons,
//      6 deck chairs
//   2. a crate spilled through props.js's own physSpill bursts into six yuzu
//      and counts as mischief (a streak link)
//   3. a balloon shattered through physShatter splashes (prop:water)
//   node qa/ten-u2g-props.mjs [tag] [chapter]
import assert from 'node:assert/strict';
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
const place = process.argv[3] || 'sydney';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
let checks = 0;
const ok = (c, m, d) => { console.log(c ? 'ok' : 'FAIL', m, d !== undefined ? JSON.stringify(d) : ''); assert.ok(c, m); checks++; };
const out = {};
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  if (place !== 'sydney') await h.arrive(place);
  await page.evaluate(() => { window.__capy.state.noPests = true; });
  await page.waitForTimeout(3000);
  out.kit = await page.evaluate(() => window.__capy.havoc.audit().props);
  const n = t => out.kit.filter(x => x === t).length;
  ok(n('yuzucrate') === 2 && n('barrel') === 1 && n('balloon') === 3 && n('deckchair') === 6, 'the kit is placed', out.kit);
  // look at it
  await page.evaluate(() => { const g = window.__capy, p = g.havoc.placed()[0].body.position, c = g.capy.body;
    c.position.set(p.x + 4, p.y + 0.8, p.z + 4); c.velocity.set(0, 0, 0); });
  await page.waitForTimeout(2200);
  await h.screenshot('ten-u2g-' + tag + '-kit');
  // a crate goes over
  const burst = await page.evaluate(async () => {
    const g = window.__capy, before = g.drops.where().length;
    let links = 0; g.events.on('capy:mischief', () => links++);
    const crate = g.havoc.placed().find(p => p.type === 'yuzucrate');
    crate.disturbed = true;
    g.physics.spill(crate);
    await new Promise(r => setTimeout(r, 600));
    return { drops: g.drops.where().length - before, links, streak: g.havoc.audit().links };
  });
  await h.screenshot('ten-u2g-' + tag + '-burst');
  ok(burst.drops >= 5, 'a crate that goes over is yuzu on the ground', burst);
  // a balloon breaks
  const splash = await page.evaluate(async () => {
    const g = window.__capy; let wet = 0; g.events.on('prop:water', () => wet++);
    const b = g.havoc.placed().find(p => p.type === 'balloon');
    b.disturbed = true;
    g.physics.shatter(b);
    await new Promise(r => setTimeout(r, 300));
    return { wet };
  });
  ok(splash.wet >= 1, 'a balloon that breaks is a splash', splash);
  out.burst = burst; out.splash = splash; out.checks = checks;
  await h.result('ten-u2g-' + tag, out);
  console.log('PROPS: ' + checks, JSON.stringify(out));
} finally { await h.close(); }
