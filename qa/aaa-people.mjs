// AAA pass: people, close. For each chapter, find the nearest drawn person
// (anything registered as a person contour: roster torsos, locals' torsos,
// Pasto's cast), put the lens 2.6 m in front of them at eye height, and draw
// the canvas with the flags cut and live. Pictures only.
//   node qa/aaa-people.mjs <tag> <flag[,flag]> [chapter ...]
import { openHarness } from './reimagine-harness.mjs';

const [tag = 'ppl', flagArg = 'noPersonRound', ...rest] = process.argv.slice(2);
const flags = flagArg.split(',');
const list = rest.length ? rest : ['sydney', 'kyoto', 'sahara', 'hanoi'];
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start();
  for (const c of list) {
    await h.arrive(c); await h.page.bringToFront(); await h.page.waitForTimeout(3500);
    const r = await h.page.evaluate(async ([fl, base]) => {
      const g = window.__capy, T = g.THREE, cp = g.capy.position;
      const cands = [], m = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      g.scene.traverse(o => {
        if (!o.userData || !o.userData.personContour || !o.visible) return;
        if (o.isInstancedMesh) {
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); m.decompose(v, q, s);
            if (s.x > 0.01 && v.y > -50) cands.push({ p: v.clone(), q: q.clone() });
          }
        } else { o.getWorldPosition(v); o.getWorldQuaternion(q); cands.push({ p: v.clone(), q: q.clone() }); }
      });
      if (!cands.length) return { n: 0 };
      cands.sort((a, b) => a.p.distanceToSquared(cp) - b.p.distanceToSquared(cp));
      const who = cands[Math.min(1, cands.length - 1)];
      const fwd = new T.Vector3(0, 0, 1).applyQuaternion(who.q); fwd.y = 0; fwd.normalize();
      const eye = who.p.clone().addScaledVector(fwd, 2.6); eye.y = who.p.y + 0.35;
      const look = who.p.clone(); look.y = who.p.y + 0.05;
      const grab = cut => {
        for (const f of fl) g.state[f] = cut;
        g.tick(1e-4, false);
        g.camera.position.copy(eye); g.camera.lookAt(look); g.camera.updateMatrixWorld();
        g.post.render();
        return g.renderer.domElement.toDataURL('image/png').split(',')[1];
      };
      const off = grab(true), on = grab(false);
      await fetch('/shot?name=' + base + '-off', { method: 'POST', body: off });
      await fetch('/shot?name=' + base + '-on', { method: 'POST', body: on });
      return { n: cands.length };
    }, [flags, `aaa-${tag}-${c}`]);
    console.log(c, JSON.stringify(r));
  }
  console.log('errors', h.metadata.errors.length, JSON.stringify(h.metadata.errors.slice(0, 2)).slice(0, 400));
} finally { await h.close(); }
