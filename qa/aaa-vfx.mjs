// AAA pass: the puff and the take, looked at. Fires a hard landing's dust at
// the animal and a startle on a stand-in 3 m to its side, then pictures the
// canvas at fixed ticks — the world is stepped by hand (game.tick) with the
// rAF loop's own frames in between, so each picture is a known age.
//   node qa/aaa-vfx.mjs [chapter] [tag]
import { openHarness } from './reimagine-harness.mjs';

const chapter = process.argv[2] || 'sydney', tag = process.argv[3] || 'vfx';
process.env.CAPY_QA_MUTE_AUDIO = '1'; process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ width: 1280, height: 720 });
try {
  await h.start(); await h.arrive(chapter); await h.page.bringToFront();
  await h.page.waitForTimeout(3500);
  for (const cut of [true, false]) {
    const out = await h.page.evaluate(async ([cut, base]) => {
      const g = window.__capy, T = g.THREE || (await import('/vendor/three.module.js'));
      for (const f of ['noPuff2', 'noTake']) g.state[f] = cut;
      const c = g.capy.position, cam = g.camera.position;
      // a stand-in person: 1.7 m box, 3 m to the camera-right of the animal
      const dx = c.x - cam.x, dz = c.z - cam.z, l = Math.hypot(dx, dz) || 1;
      const who = new T.Group(); who.position.set(c.x - dz / l * 2.2, c.y - 0.3, c.z + dx / l * 2.2);
      const body = new T.Mesh(new T.BoxGeometry(0.5, 1.7, 0.3), new T.MeshLambertMaterial({ color: 0x8a6d5a }));
      body.position.y = 0.85; who.add(body); g.scene.add(who);
      const shots = [];
      g.events.emit('capy:land', { position: { x: c.x, y: c.y, z: c.z }, fall: 12 });
      g.events.emit('npc:startled', { npc: { group: who } });
      let t = 0;
      for (const at of [0.12, 0.3, 0.55]) {
        while (t < at - 1e-6) { g.tick(1 / 60, false); t += 1 / 60; }
        g.tick(1e-4, true);
        shots.push(g.renderer.domElement.toDataURL('image/png').split(',')[1]);
      }
      g.scene.remove(who);
      for (let i = 0; i < shots.length; i++)
        await fetch('/shot?name=' + base + '-' + (cut ? 'off' : 'on') + '-' + i, { method: 'POST', body: shots[i] });
      return { n: shots.length, err: g.state.lastError || null };
    }, [cut, `aaa-${tag}-${chapter}`]);
    console.log(cut ? 'cut' : 'live', JSON.stringify(out));
    await h.page.waitForTimeout(1500);
  }
  console.log('errors', h.metadata.errors.length, JSON.stringify(h.metadata.errors.slice(0, 3)).slice(0, 500));
} finally { await h.close(); }
