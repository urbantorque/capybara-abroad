// ROADMAP-FREE-ROAM: real-clock warnings, recovery and keyboard counterplay.
// Each pest starts on a fresh Free Roam file; only its starting position is
// staged. No manual ticks, synthetic damage or saved progress. Headful GPU.
// node qa/free-roam-pressure.mjs baseline|tuned
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'tuned';
const tuned = tag !== 'baseline';
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const out = { tag, at: new Date().toISOString(), scenarios: [], checks: 0 };
const save = () => writeFileSync(new URL(`./free-roam-${tag}.json.png`, import.meta.url), JSON.stringify(out, null, 2));
const ok = (condition, message) => { assert.ok(condition, message); out.checks++; console.log('ok', message); };

try {
  for (const kind of ['warden', 'gull']) {
    const h = await openHarness({ width: 1280, height: 720 });
    const { page } = h;
    const record = { kind, metadata: h.metadata };
    out.scenarios.push(record);
    try {
      await h.start();
      await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 30000 });
      await page.evaluate(kind => {
        const g = window.__capy;
        g.state.noHavoc = true; // Keep the nearby run ring out of this walking test.
        const probe = window.__pressure = { samples: [], hits: [], kos: [], last: null };
        g.events.on('havoc:hit', e => probe.hits.push({ at: performance.now(), time: g.state.time,
          hearts: e.hearts, invuln: g.havoc.audit().invuln }));
        g.events.on('havoc:ko', e => probe.kos.push(e.kind));
        probe.timer = setInterval(() => {
          const a = g.havoc.audit(), p = g.capy.position;
          const enemy = a.pests.find(q => q.kind === kind && q.state !== 'ko');
          probe.samples.push({ at: performance.now(), time: g.state.time, enemy,
            hearts: a.hearts, capy: { x: p.x, y: p.y, z: p.z }, hidden: document.hidden });
        }, 40);
        g.havoc.qaPest(kind, kind === 'warden' ? 6 : 8);
      }, kind);
      const waitState = state => page.waitForFunction(({ kind, state }) =>
        window.__capy.havoc.audit().pests.some(q => q.kind === kind && q.state === state),
      { kind, state }, { timeout: 25000 });
      if (kind === 'warden') {
        await waitState('wind');
        await h.screenshot(`free-roam-${tag}-warden-warning`);
        await waitState('charge');
        await waitState('tired');
        await waitState('in');
        // V remains effective after the longer recovery; aim the test fixture,
        // then send the same keyboard events the player uses to flick a pip.
        for (let i = 0; i < 8 && !await page.evaluate(() => window.__pressure.kos.includes('warden')); i++) {
          await page.evaluate(() => {
            const g = window.__capy, p = g.capy.position;
            const e = g.havoc.audit().pests.find(q => q.kind === 'warden' && q.state !== 'ko');
            if (e) g.capy.group.rotation.y = Math.atan2(e.x - p.x, e.z - p.z);
          });
          await h.hold('KeyV', 60);
          await page.waitForTimeout(400);
        }
      } else {
        await waitState('aim');
        await h.screenshot(`free-roam-${tag}-gull-warning`);
        record.beforeDodge = await page.evaluate(() => window.__capy.havoc.hearts());
        await h.hold('KeyD', 1600);
        await waitState('climb');
        record.afterDodge = await page.evaluate(() => window.__capy.havoc.hearts());
        await h.screenshot(`free-roam-${tag}-gull-dodged`);
      }
      record.trace = await page.evaluate(() => {
        clearInterval(window.__pressure.timer);
        const { samples, hits, kos } = window.__pressure;
        return { samples, hits, kos, lastError: window.__capy.state.lastError || null };
      });
      record.transitions = record.trace.samples.filter((s, i, all) =>
        s.enemy?.state && s.enemy.state !== all[i - 1]?.enemy?.state)
        .map(s => ({ state: s.enemy.state, time: s.time, at: s.at }));
      const duration = state => {
        const i = record.transitions.findIndex(s => s.state === state);
        return i >= 0 && record.transitions[i + 1] ? record.transitions[i + 1].time - record.transitions[i].time : null;
      };
      record.warningSeconds = duration(kind === 'warden' ? 'wind' : 'aim');
      record.recoverySeconds = duration(kind === 'warden' ? 'tired' : 'circle');
      ok(record.trace.samples.every(s => !s.hidden), `${kind}: foreground samples`);
      ok(!record.trace.lastError && !h.metadata.errors.length, `${kind}: no runtime errors`);
      if (kind === 'warden') {
        ok(record.trace.kos.includes('warden'), 'V still knocks out the officer');
        ok(record.trace.hits.length > 0, 'an ignored officer charge still costs a heart');
        if (tuned) {
          ok(record.warningSeconds >= 1.5, 'officer warning lasts at least 1.5 seconds');
          ok(record.recoverySeconds >= 3.4, 'officer rests at least 3.4 seconds');
          ok(record.trace.hits.every(s => s.invuln >= 2.49), 'hits grant 2.5 seconds protection');
        }
      } else {
        ok(record.afterDodge === record.beforeDodge, 'walking sideways evades the marked bird dive');
        if (tuned) {
          ok(record.warningSeconds >= 1.3, 'bird shadow warns for at least 1.3 seconds');
          ok(record.recoverySeconds >= 5.9, 'bird circles for at least 5.9 seconds before attacking');
        }
      }
      console.log(JSON.stringify({ kind, warning: record.warningSeconds, recovery: record.recoverySeconds, hits: record.trace.hits.length }));
    } finally { save(); await h.close(); }
  }
  const h = await openHarness({ story: true, width: 1280, height: 720 });
  try {
    await h.start();
    await h.page.waitForTimeout(5000);
    out.story = await h.page.evaluate(() => ({ mode: window.__capy.state.journeyMode, audit: window.__capy.havoc.audit() }));
    ok(out.story.mode === 'story' && !out.story.audit.live && !out.story.audit.pests.length, 'Story mode has no HAVOC pests');
  } finally { await h.close(); }
} catch (error) {
  out.failure = String(error.stack || error); console.error(out.failure); process.exitCode = 1;
} finally { save(); }
