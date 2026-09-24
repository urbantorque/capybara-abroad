// ROADMAP-TEN T3 proof slot: what a render-side sight ray costs in Sydney, and
// what it hits between the arrival lens and the cameo's last spot (6.4, 0.9).
import { openHarness } from './reimagine-harness.mjs';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720, story: true });
try {
  await h.start(); await h.page.waitForTimeout(3000);
  const r = await h.page.evaluate(() => {
    const g = window.__capy, T = g.THREE, c = g.camera.position;
    const rc = new T.Raycaster(), a = new T.Vector3(), b = new T.Vector3(), out = [];
    for (const [x, z] of [[6.4, 0.9], [-8, 2], [10, 6], [0, 0]]) {
      a.copy(c); b.set(x, 1.8, z); const d = a.distanceTo(b);
      rc.set(a, b.sub(a).normalize()); rc.far = d - 0.5;
      const t0 = performance.now();
      const hits = rc.intersectObjects(g.scene.children, true).filter(i => i.object.isMesh && i.object.visible);
      const ms = performance.now() - t0;
      out.push({ x, z, d: +d.toFixed(1), ms: +ms.toFixed(2), hits: hits.slice(0, 5).map(i => ({ n: i.object.name || i.object.type, inst: !!i.object.isInstancedMesh, cnt: i.object.count, dist: +i.distance.toFixed(1), shadow: i.object.castShadow, par: i.object.parent && i.object.parent.name })) });
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
} finally { await h.close(); }
