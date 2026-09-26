// The soft matte pass, photographed (ROADMAP-TEN V1-V5). Headful, real GPU.
// Per chapter: the arrival frame as the rig leaves it, and a close portrait
// of the nearest person from a lens pinned 3.2 m off them at head height,
// drawn and read back in one task (tick 1e-4, post.render, toDataURL).
//   node qa/ten-v-look.mjs [tag] [chapter,...]
import { openHarness } from './reimagine-harness.mjs';
const tag = process.argv[2] || 'a';
const places = (process.argv[3] || 'sydney,kowloon,rio,hanoi,venice,kyoto').split(',');
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
const { page } = h;
try {
  await h.start();
  await page.waitForFunction(() => window.__capy.havocOK(), null, { timeout: 40000 });
  await page.evaluate(() => { window.__capy.state.noPests = true; });
  for (const pl of places) {
    if (pl !== 'sydney') await h.arrive(pl);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(async ([pl, tag]) => {
      const g = window.__capy, THREE = g.THREE;
      const shot = async (name) => { const u = g.renderer.domElement.toDataURL('image/png'); await fetch('/shot?name=' + name, { method: 'POST', body: u.split(',')[1] }); };
      g.tick(1e-4, true); await shot('ten-v-' + tag + '-' + pl + '-wide');
      // the nearest visible person-shaped mesh group: a local if the chapter has one
      const p = g.capy.position; let best = null, bd = 1e9;
      for (const L of (g.locals || [])) {
        const grp = L && L.fig && L.fig.group; if (!grp || !grp.visible) continue;
        const v = new THREE.Vector3(); grp.getWorldPosition(v);
        const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd) { bd = d; best = v; }
      }
      if (!best) return { local: false };
      g.tick(1e-4, false);
      const cam = g.camera;
      cam.position.set(best.x + 2.4, best.y + 1.7, best.z + 2.1);
      cam.lookAt(best.x, best.y + 1.1, best.z); cam.updateMatrixWorld(true);
      g.post.render();
      await shot('ten-v-' + tag + '-' + pl + '-person');
      return { local: true, d: +bd.toFixed(1) };
    }, [pl, tag]);
    console.log(pl, JSON.stringify(r));
  }
} finally { await h.close(); }
