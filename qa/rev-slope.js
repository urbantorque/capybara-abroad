async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit2');          // Pasto
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const g = window.__capy;
    const api = g.pasto;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
    const sp = g.biome.spawnOf('pasto');
    // find a walkable spot ~22-30 degrees, within 90 m of spawn
    let best = null;
    for (let d = 15; d < 90; d += 3) {
      for (let a = 0; a < 6.283; a += 0.14) {
        const x = sp.x + Math.cos(a) * d, z = sp.z + Math.sin(a) * d;
        const h = th(x, z);
        const gx = (th(x + 1, z) - th(x - 1, z)) / 2;
        const gz = (th(x, z + 1) - th(x, z - 1)) / 2;
        const s = Math.hypot(gx, gz);
        const deg = Math.atan(s) * 180 / Math.PI;
        if (deg > 21 && deg < 30) {
          // uphill direction
          const ux = gx / s, uz = gz / s;
          if (!best) best = { x, z, h, deg: +deg.toFixed(1), ux, uz, d: Math.round(d) };
        }
      }
      if (best) break;
    }
    if (!best) return { found: false };
    const body = g.capy.body;
    body.position.set(best.x, best.h + 0.4, best.z);
    body.velocity.set(0, 0, 0);
    body.previousPosition.copy(body.position);
    body.interpolatedPosition.copy(body.position);
    g.capy.carriedBy = null;
    window.__slope = best;
    return { found: true, spot: best };
  });

  if (!info.found) {
    await page.evaluate(async () => {
      await fetch('/shot?name=rev-slope.json', { method: 'POST', body: btoa('{"found":false}') });
    });
    return;
  }

  // let real rAF settle it onto the hill, walking uphill so the pose is a
  // WALKING pose rather than an idle one
  await page.waitForTimeout(1200);
  const held = ['KeyW'];
  await page.evaluate((ks) => {
    const g = window.__capy;
    const b = window.__slope;
    // face uphill in camera-relative terms
    const cy = g.input.camYaw || 0;
    window.__stick = { ux: b.ux, uz: b.uz, cy: cy };
  }, held);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(600);

  const meas = await page.evaluate(() => {
    const g = window.__capy;
    const api = g.pasto;
    const th = (x, z) => { const v = api.terrainHeight(x, z); return (v === v) ? v : 0; };
    const b = g.capy.body;
    const x = b.position.x, z = b.position.z, y = b.position.y;
    // where the drawn model puts its nose and tail, and what the ground is there
    const yaw = g.capy.yaw !== undefined ? g.capy.yaw : 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const L = 0.45;
    const gC = th(x, z);
    const gN = th(x + fx * L, z + fz * L);
    const gT = th(x - fx * L, z - fz * L);
    // the model is drawn flat at (render y - 0.34); its nose sits at that height
    const modelY = y - 0.34;
    return {
      pos: [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)],
      groundCentre: +gC.toFixed(2), groundNose: +gN.toFixed(2), groundTail: +gT.toFixed(2),
      modelFootY: +modelY.toFixed(2),
      noseBuriedBy: +(gN - modelY).toFixed(2),
      tailFloatBy: +(modelY - gT).toFixed(2),
      slopeDeg: window.__slope.deg,
      camPos: [+g.camera.position.x.toFixed(1), +g.camera.position.y.toFixed(1), +g.camera.position.z.toFixed(1)],
    };
  });

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rev-slope.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, meas);
}
