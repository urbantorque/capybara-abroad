// The range behind the range (ROADMAP-TEN U2b, noFarLayers) and, when it
// exists, the cloud shadows (U2c, noCloudShadow). Headful, real GPU, rung 0.
// Per chapter: arrive, settle, then a frozen A/B — both arms drawn and read
// back inside one task (tick 1e-4, toDataURL twice) so the lens and the world
// are the same frame — posted to the /shot sink as PNGs, with the far audit.
//   node qa/ten-u2b-far.mjs [tag] [flag] [chapter,chapter,...]
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
const flag = process.argv[3] || 'noFarLayers';
const places = (process.argv[4] || 'sydney,kyoto,rio,iceland,monaco,kowloon').split(',');
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
const out = {};
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  await page.evaluate(f => { window.__capy.state.noPests = true; window.__capy.state.noHavoc = true; window.__cldForce = f; }, +(process.env.CLD_FORCE || 0));
  for (const pl of places) {
    if (pl !== 'sydney') await h.arrive(pl);
    await page.waitForTimeout(3000);
    out[pl] = await page.evaluate(async ([pl, flag, tag]) => {
      const g = window.__capy;
      const src = g.renderer.domElement, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
      const cx = cv.getContext('2d'); let prev = null, diff = 0;
      // both arms BEFORE any await: an await lets a frame run and the world move
      const urls = [];
      const shoot = (cut) => {
        g.state[flag] = cut;
        g.tick(1e-4, true);
        cx.drawImage(src, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height).data;
        if (prev) { for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]) > 12) diff++; }
        else prev = d.slice();
        urls.push(src.toDataURL('image/png'));
      };
      if (flag === 'noCloudShadow' && window.__cldForce) g.state.qaCloudK = window.__cldForce;
      shoot(false); shoot(true);
      g.state.qaCloudK = undefined;
      await fetch('/shot?name=ten-u2-' + tag + '-' + pl + '-live', { method: 'POST', body: urls[0].split(',')[1] });
      await fetch('/shot?name=ten-u2-' + tag + '-' + pl + '-cut', { method: 'POST', body: urls[1].split(',')[1] });
      g.state[flag] = false;
      const a = g.far && g.far.audit ? g.far.audit() : null;
      return { changed: +(diff / (cv.width * cv.height)).toFixed(4), far: a && { name: a.name, back: !!(g.far.back) } };
    }, [pl, flag, tag]);
    console.log(pl, JSON.stringify(out[pl]));
  }
} finally { await h.close(); }
