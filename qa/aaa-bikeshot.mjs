// AAA A1: a Hanoi scooter, close. Finds the scooter meshes (the six
// instanced body colours: 30-50 instances, shadow-casting, vertex-coloured),
// picks the instance nearest the animal, and draws it from its side and its
// front three-quarter with the flags cut and live. Pictures only.
//   node qa/aaa-bikeshot.mjs <tag> [flag]
import { openHarness } from './reimagine-harness.mjs';

const tag = process.argv[2] || 'bk', flag = process.argv[3] || 'noBike2';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start(); await h.arrive('hanoi'); await h.page.bringToFront(); await h.page.waitForTimeout(4000);
  const r = await h.page.evaluate(async ([flag, base]) => {
    const g = window.__capy, T = g.THREE, cp = g.capy.position;
    const meshes = [];
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count >= 25 && o.count <= 60 && o.castShadow && o.material.vertexColors) meshes.push(o); });
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
    let best = null;
    for (const mm of meshes) for (let i = 0; i < mm.count; i++) {
      mm.getMatrixAt(i, m); m.decompose(p, q, s);
      const d = p.distanceTo(cp);
      if (!best || d < best.d) best = { d, p: p.clone(), q: q.clone(), mm, i };
    }
    if (!best) return { meshes: meshes.length };
    const out = {};
    for (const [name, ang, dist] of [['side', Math.PI / 2, 3.2], ['front', 0.6, 3.6]]) {
      const shots = [];
      for (const cut of [true, false]) {
        g.state[flag] = cut;
        g.tick(1e-4, false);
        // re-read the instance: the tick moved it by a hair
        best.mm.getMatrixAt(best.i, m); m.decompose(p, q, s);
        const dir = new T.Vector3(Math.sin(ang), 0, Math.cos(ang)).applyQuaternion(q);
        g.camera.position.copy(p).addScaledVector(dir, dist); g.camera.position.y = p.y + 1.25;
        g.camera.lookAt(p.x, p.y + 0.85, p.z); g.camera.updateMatrixWorld();
        g.post.render();
        shots.push(g.renderer.domElement.toDataURL('image/png').split(',')[1]);
      }
      g.state[flag] = false;
      await fetch('/shot?name=' + base + '-' + name + '-off', { method: 'POST', body: shots[0] });
      await fetch('/shot?name=' + base + '-' + name + '-on', { method: 'POST', body: shots[1] });
    }
    return { meshes: meshes.length, d: +best.d.toFixed(1), tris: best.mm.geometry.index.count / 3 };
  }, [flag, `aaa-${tag}`]);
  console.log(JSON.stringify(r), 'errors', h.metadata.errors.length, JSON.stringify(h.metadata.errors.slice(0, 2)).slice(0, 300));
} finally { await h.close(); }
