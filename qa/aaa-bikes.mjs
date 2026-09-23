// AAA A1: are Hanoi's scooters choppy, and where? Reads every scooter's
// instance matrix each rendered frame for 6 s (the six body-colour meshes are
// the only InstancedMeshes in Hanoi's root with 30-50 instances and a hanTyre
// wheel), and reports per-frame jumps: position step against the median,
// yaw and roll (lean) change per frame, and speed reversals.
//   node qa/aaa-bikes.mjs [tag]
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'bikes', cutFlag = process.argv[3] || '';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start(); await h.arrive('hanoi'); await h.page.bringToFront(); await h.page.waitForTimeout(4000);
  const r = await h.page.evaluate(async (cutFlag) => {
    const g = window.__capy, T = g.THREE;
    if (cutFlag) g.state[cutFlag] = true;
    const meshes = [];
    g.scene.traverse(o => { if (o.isInstancedMesh && o.name === 'hanBikes') meshes.push(o); });
    if (!meshes.length) g.scene.traverse(o => { if (o.isInstancedMesh && o.count >= 20 && o.count <= 60 && o.castShadow && o.geometry.attributes.position.count > 300 && o.geometry.attributes.position.count < 2000) meshes.push(o); });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3(), e = new T.Euler();
    const tracks = [];
    const frames = [];
    const t0 = performance.now();
    await new Promise(res => {
      const step = () => {
        const row = [];
        for (const mm of meshes) for (let i = 0; i < Math.min(mm.count, 12); i++) {
          mm.getMatrixAt(i, m); m.decompose(p, q, s); e.setFromQuaternion(q, 'YXZ');
          row.push([p.x, p.z, e.y, e.z]);
        }
        frames.push({ t: performance.now(), row });
        if (performance.now() - t0 < 6000) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
    // per bike: steps
    const nB = frames[0].row.length, stats = { yawJumps: 0, leanJumps: 0, posJumps: 0, stops: 0, samples: 0, maxYaw: 0, maxLean: 0 };
    for (let b = 0; b < nB; b++) {
      const steps = [];
      for (let f = 1; f < frames.length; f++) {
        const a = frames[f - 1].row[b], c = frames[f].row[b];
        const d = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (d > 5) continue;   // a recycle, not motion
        steps.push(d);
        let dy = c[2] - a[2]; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        const dl = Math.abs(c[3] - a[3]);
        stats.maxYaw = Math.max(stats.maxYaw, Math.abs(dy)); stats.maxLean = Math.max(stats.maxLean, dl);
        if (Math.abs(dy) > 0.06) stats.yawJumps++;
        if (dl > 0.03) stats.leanJumps++;
        stats.samples++;
      }
      const sorted = steps.slice().sort((x, y) => x - y), med = sorted[sorted.length >> 1] || 0;
      for (let i = 1; i < steps.length; i++) if (med > 0.02 && steps[i] > med * 1.8 && steps[i] - steps[i - 1] > 0.05) stats.posJumps++;
      for (let i = 1; i < steps.length; i++) if (steps[i - 1] > 0.05 && steps[i] < 0.005) stats.stops++;
    }
    const dts = frames.slice(1).map((f, i) => f.t - frames[i].t).sort((a, b) => a - b);
    return { meshes: meshes.length, bikes: nB, frames: frames.length, dtMed: +dts[dts.length >> 1].toFixed(1), dtP95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), stats };
  }, cutFlag);
  console.log(JSON.stringify(r));
} finally { await h.close(); }
