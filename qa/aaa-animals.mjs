// AAA pass: animals, close. For each chapter, every mesh a chapter tagged
// `userData.roundAnimal` (its rounded twin handed to game.personRound): the
// nearest live instance to the capybara, the lens at 2.3 bounding radii off
// its front quarter, drawn with noPersonRound cut and live, side by
// side, one row per mesh, into ONE contact sheet: qa/aaa-animals-<chapter>.png.
//   node qa/aaa-animals.mjs <chapter> [chapter ...]
import { openHarness } from './reimagine-harness.mjs';

const list = process.argv.slice(2);
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 960, height: 540 });
try {
  await h.start();
  for (const c of list) {
    await h.arrive(c); await h.page.bringToFront(); await h.page.waitForTimeout(3500);
    const r = await h.page.evaluate(async (base) => {
      const g = window.__capy, T = g.THREE, cp = g.capy.position;
      const meshes = [];
      g.scene.traverse(o => { if (o.userData && o.userData.roundAnimal) meshes.push(o); });
      const W = 480, H = 270, sheet = document.createElement('canvas');
      sheet.width = W * 2; sheet.height = Math.max(1, meshes.length) * H;
      const cx = sheet.getContext('2d');
      cx.fillStyle = '#000'; cx.fillRect(0, 0, sheet.width, sheet.height);
      const m4 = new T.Matrix4(), v = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
      const rows = [];
      meshes.forEach((o, row) => {
        g.tick(1e-4, false);
        o.updateMatrixWorld(true);
        let best = null;
        const cand = (p, qq, sc) => { const d = p.distanceToSquared(cp); if (!best || d < best.d) best = { p: p.clone(), q: qq.clone(), s: sc, d }; };
        if (o.isInstancedMesh) {
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); m4.decompose(v, q, s);
            if (Math.max(s.x, s.y, s.z) > 0.01 && v.y > -50) cand(v, q, Math.max(s.x, s.y, s.z));
          }
          // all parked (a school still in its tank): draw instance 0 where it is
          if (!best && o.count) { o.getMatrixAt(0, m4); m4.premultiply(o.matrixWorld); m4.decompose(v, q, s); cand(v, q, Math.max(0.01, s.x, s.y, s.z)); }
        } else { o.matrixWorld.decompose(v, q, s); cand(v, q, Math.max(s.x, s.y, s.z)); }
        if (!best) { rows.push({ name: o.name, n: 0 }); return; }
        if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
        const bs = o.geometry.boundingSphere, rad = Math.max(0.12, bs.radius * best.s);
        const ctr = bs.center.clone().multiplyScalar(best.s).applyQuaternion(best.q).add(best.p);
        const fwd = new T.Vector3(0, 0, 1).applyQuaternion(best.q); fwd.y = 0;
        if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1); fwd.normalize();
        fwd.applyAxisAngle(new T.Vector3(0, 1, 0), 1.05);
        const dist = Math.max(0.8, rad * 2.3);
        const eye = ctr.clone().addScaledVector(fwd, dist); eye.y += dist * 0.35;
        // everything up the tree visible for the picture, put back after
        const hid = []; for (let p = o; p; p = p.parent) if (!p.visible) { hid.push(p); p.visible = true; }
        const shot = (cut, col) => {
          g.state.noPersonRound = cut;
          g.tick(1e-4, false);
          for (const p of hid) p.visible = true;
          g.camera.position.copy(eye); g.camera.lookAt(ctr); g.camera.updateMatrixWorld();
          g.post.render();
          cx.drawImage(g.renderer.domElement, col * W, row * H, W, H);
        };
        shot(true, 0); shot(false, 1);
        for (const p of hid) p.visible = false;
        cx.fillStyle = '#ff0'; cx.font = '14px monospace';
        cx.fillText(`${o.name || o.type} ${o.isInstancedMesh ? 'x' + o.count : ''} OFF`, 6, row * H + 16);
        cx.fillText('ON (rounded)', W + 6, row * H + 16);
        rows.push({ name: o.name, n: o.isInstancedMesh ? o.count : 1, at: best.p.toArray().map(x => +x.toFixed(1)),
          d: +Math.sqrt(best.d).toFixed(1), rad: +rad.toFixed(2) });
      });
      g.state.noPersonRound = false;
      const png = sheet.toDataURL('image/png').split(',')[1];
      await fetch('/shot?name=' + base, { method: 'POST', body: png });
      return { meshes: meshes.length, audit: g.personRoundAudit && g.personRoundAudit(), rows };
    }, `aaa-animals-${c}`);
    console.log(c, JSON.stringify(r));
  }
  console.log('errors', h.metadata.errors.length, JSON.stringify(h.metadata.errors.slice(0, 3)).slice(0, 600));
} finally { await h.close(); }
