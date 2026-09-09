async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5500);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(2500);
  const out = {};

  // ---- ON THE TWO --------------------------------------------------------
  // The hand-driven tick loop runs hundreds of sim frames per real second, but
  // ac.currentTime is a REAL clock — so fourteen hops inside one page.evaluate
  // all sample the same beat phase and the window is either hit by all of them
  // or by none. Real waits between hops, and the phase is read at the press so
  // the result is attributable rather than a number.
  await page.evaluate(() => { window.__capy.biome.switchTo('cali'); });
  await page.waitForTimeout(1500);
  out.beat = await (async () => {
    const rows = [];
    for (const force of [false, true]) {
      for (let n = 0; n < 16; n++) {
        const r = await page.evaluate((F) => {
          const g = window.__capy, c = g.capy;
          if (F) c.learn('beat', true); else c.learn('beat', false);
          const sp = g.biome.spawnOf('cali'), b = c.body;
          b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
          const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
          const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
          const T = () => { if (F) c.learn('beat', true); g.tick(1 / 60, false); };
          for (let i = 0; i < 40; i++) T();
          const x0 = b.position.x, z0 = b.position.z, y0 = b.position.y;
          const off = g.music.off();
          down('Space');
          let hi = 0;
          for (let i = 0; i < 64; i++) { T(); if (i === 2) up('Space'); hi = Math.max(hi, b.position.y - y0); }
          return { force: F, off: +off.toFixed(3),
                   dist: +Math.hypot(b.position.x - x0, b.position.z - z0).toFixed(2),
                   apex: +hi.toFixed(3), flash: +c.beatFlash.toFixed(2) };
        }, force);
        rows.push(r);
        await page.waitForTimeout(130);      // let the real beat phase move on
      }
    }
    const onBeat = rows.filter(r => Math.abs(r.off) < 0.16);
    const offBeat = rows.filter(r => Math.abs(r.off) >= 0.16);
    const avg = (a, k) => a.length ? +(a.reduce((s, r) => s + r[k], 0) / a.length).toFixed(2) : null;
    return {
      n: rows.length,
      skillOn_onBeat: { n: onBeat.filter(r => r.force).length,
                        dist: avg(onBeat.filter(r => r.force), 'dist'),
                        apex: avg(onBeat.filter(r => r.force), 'apex'),
                        flashed: onBeat.filter(r => r.force && r.flash > 0.2).length },
      skillOn_offBeat: { n: offBeat.filter(r => r.force).length,
                         dist: avg(offBeat.filter(r => r.force), 'dist'),
                         apex: avg(offBeat.filter(r => r.force), 'apex') },
      skillOff_onBeat: { n: onBeat.filter(r => !r.force).length,
                         dist: avg(onBeat.filter(r => !r.force), 'dist'),
                         apex: avg(onBeat.filter(r => !r.force), 'apex') },
    };
  })();

  // ---- THE VAULT and THE MANTLE ------------------------------------------
  // Find a real wall first. The spawn sweep deliberately puts the animal in the
  // clear, so "five metres out from the spawn" found no hold at any bearing and
  // the first vault probe measured a mechanic that had nothing to push off.
  await page.evaluate(() => { window.__capy.biome.switchTo('kowloon'); });
  await page.waitForTimeout(2500);
  const wall = await page.evaluate(() => {
    const g = window.__capy, c = g.capy;
    const sp = g.biome.spawnOf('kowloon');
    for (let r = 3; r <= 26; r += 1.5) {
      for (let a = 0; a < 6.28; a += 0.3) {
        const x = sp.x + Math.sin(a) * r, z = sp.z + Math.cos(a) * r;
        const y = (typeof g.groundY === 'function' ? g.groundY(x, z) : sp.y) + 0.5;
        const h = c.climbAt(x, y, z, a);
        if (h) return { x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2),
                        yaw: +a.toFixed(2), top: h.top === undefined ? null : +h.top.toFixed(2) };
      }
    }
    return null;
  });
  out.wall = wall;

  if (wall) { await page.evaluate((w)=>{ window.__wall = w; }, wall);
    out.vault = {};
    for (const force of [false, true]) {
      out.vault[force ? 'on' : 'off'] = await page.evaluate((F) => {
        const g = window.__capy, c = g.capy;
        const b = c.body;
        const down = k => window.dispatchEvent(new KeyboardEvent('keydown', { code: k, bubbles: true }));
        const up = k => window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        const W = window.__wall;
        const T = () => { c.learn('vault', !!F); c.learn('mantle', false); c.learn('seed', false); g.tick(1 / 60, false); };
        // stand back from the face, run at it, hop, then hop again on the way up
        b.position.set(W.x - Math.sin(W.yaw) * 2.2, W.y + 0.4, W.z - Math.cos(W.yaw) * 2.2);
        b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        c.face(W.yaw);
        for (let i = 0; i < 40; i++) T();
        const y0 = b.position.y;
        down('KeyW');
        for (let i = 0; i < 26; i++) T();
        down('Space'); for (let i = 0; i < 4; i++) T(); up('Space');
        for (let i = 0; i < 12; i++) T();
        down('Space'); for (let i = 0; i < 4; i++) T(); up('Space');   // the kick
        let hi = 0;
        for (let i = 0; i < 70; i++) { T(); hi = Math.max(hi, b.position.y - y0); }
        up('KeyW');
        return { can: c.can('vault'), rise: +hi.toFixed(2) };
      }, force);
      await page.waitForTimeout(300);
    }
  }

  await page.evaluate(async (o) => {
    await fetch('/shot?name=skills3.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
