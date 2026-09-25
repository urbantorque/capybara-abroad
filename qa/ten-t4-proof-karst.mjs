// ROADMAP-TEN T4 proof slot: noPalKarstSolid at the lagoon wall, headful at
// rung 0, and the Pantanal arrival's frame tail after the white card.
// The wall: T4e's three spots, the lens let settle on its own for 4 s, then
// the same instant drawn cut and live (a 1e-4 s tick each, aaa-ab's grab) and
// read back in the page: the pixels that changed, and T4e's dither holes (a
// pixel 40+ darker or lighter than both horizontal neighbours) per thousand,
// each arm. The capsule is damped, so the cut arm is drawn first.
//   CAPY_QA_URL=http://localhost:5199/ node qa/ten-t4-proof-karst.mjs
import { openHarness, measureTicks } from './reimagine-harness.mjs';
process.env.CAPY_QA_MUTE_AUDIO = '1';
process.env.CAPY_QA_NO_THROTTLE = '1';
const h = await openHarness({ url: process.env.CAPY_QA_URL || 'http://localhost:5199/', width: 1280, height: 720 });
const p = h.page;
const out = { spots: {}, errors: h.metadata.errors };
try {
  await h.start();
  await h.arrive('palawan');
  await p.waitForTimeout(5000);
  const spots = [{ key: 'wallAhead', x: -6, z: -24, yaw: Math.PI }, { key: 'wallBehind', x: -6, z: -24, yaw: 0 },
                 { key: 'west', x: -21, z: -28, yaw: Math.PI * 0.75 }];
  for (const s of spots) {
    await p.evaluate(s => {
      const g = window.__capy, b = g.capy.body;
      b.position.set(s.x, 0.3, s.z); b.velocity.set(0, 0, 0);
      if (g.input) g.input.camYaw = s.yaw;
    }, s);
    await p.waitForTimeout(4000);
    await h.screenshot('ten-t4-proof-karst-' + s.key);
    out.spots[s.key] = await p.evaluate(async name => {
      const g = window.__capy, c = g.renderer.domElement;
      const grab = cut => { g.state.noPalKarstSolid = cut; g.tick(1e-4, true);
        const x = document.createElement('canvas'); x.width = c.width; x.height = c.height;
        const k = x.getContext('2d'); k.drawImage(c, 0, 0); return { url: c.toDataURL('image/png'), d: k.getImageData(0, 0, c.width, c.height).data }; };
      const off = grab(true), on = grab(false);
      await fetch('/shot?name=' + name + '-off', { method: 'POST', body: off.url.split(',')[1] });
      await fetch('/shot?name=' + name + '-on', { method: 'POST', body: on.url.split(',')[1] });
      const W = c.width, H = c.height, L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const holes = d => { let n = 0; for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = (y * W + x) * 4, l = L(d, i), dl = l - L(d, i - 4), dr = l - L(d, i + 4);
        if ((dl > 40 && dr > 40) || (dl < -40 && dr < -40)) n++; } return +(n / (W * H) * 1000).toFixed(3); };
      let changed = 0;
      for (let i = 0; i < off.d.length; i += 4) if (Math.abs(off.d[i] - on.d[i]) + Math.abs(off.d[i + 1] - on.d[i + 1]) + Math.abs(off.d[i + 2] - on.d[i + 2]) > 24) changed++;
      const cam = g.camera.position, q = g.capy.position;
      return { changedPct: +(changed / (W * H) * 100).toFixed(2), holesCut: holes(off.d), holesLive: holes(on.d),
        lensToAnimal: +Math.hypot(cam.x - q.x, cam.y - q.y, cam.z - q.z).toFixed(2), rung: g.state.perfRung, lastError: g.state.lastError || null };
    }, 'ten-t4-proof-karst-' + s.key);
    console.log(s.key, JSON.stringify(out.spots[s.key]));
  }
  // ---- the Pantanal arrival at rung 0, once the white card has let go
  await h.arrive('pantanal');
  await p.waitForTimeout(3000);
  out.pantanal = await measureTicks(p, 10000);
  console.log('pantanal', JSON.stringify(out.pantanal));
  await h.result('ten-t4-proof-karst', out);
  console.log('errors', out.errors.length, JSON.stringify(out.errors.slice(0, 3)).slice(0, 600));
} finally { await h.close(); }
