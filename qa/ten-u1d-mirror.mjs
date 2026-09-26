// The mirror at rung 1 (ROADMAP-TEN U1d, noReflectHalf). Headful, real GPU.
// Pins "pretty" (rung 0) through prefs, then writes the rung to 1 by hand:
// in pretty the governor does not rewrite it. For each chapter: the lens is
// pinned, the frame is drawn live and with the flag set, and the mirror's own
// verdict (reflectInfo) and the frame time of each arm are read.
//   node qa/ten-u1d-mirror.mjs [tag] [kyoto,venice,...]
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
const places = (process.argv[3] || 'kyoto,venice,quay').split(',');
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
const out = {};
try {
  await h.start();
  for (const pl of places) {
    await h.arrive(pl);
    await page.waitForTimeout(2500);
    const r = {};
    for (const cut of [false, true]) {
      r[cut ? 'cut' : 'live'] = await page.evaluate(async cut => {
        const g = window.__capy;
        g.state.perfRung = 1; g.state.noReflectHalf = cut;
        // a few frames for the damped strength to settle
        for (let i = 0; i < 20; i++) await new Promise(res => requestAnimationFrame(res));
        const info = g.reflectInfo();
        const t0 = performance.now();
        for (let i = 0; i < 20; i++) await new Promise(res => requestAnimationFrame(res));
        return { why: info.why, drawn: info.drawn, size: info.size, ms: info.ms, frame: (performance.now() - t0) / 20 };
      }, cut);
      await h.screenshot('ten-u1d-' + tag + '-' + pl + (cut ? '-cut' : '-live'));
    }
    out[pl] = r;
    console.log(pl, JSON.stringify(r));
  }
  await h.result('ten-u1d-' + tag, out);
} finally { await h.close(); }
