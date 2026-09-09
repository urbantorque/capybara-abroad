async page => {
  // ---------------------------------------------------------------------------
  // qa/q1-chains.js — WHAT A CHAIN IS ACTUALLY MADE OF (ROADMAP-NEXT item 4)
  //
  // The Repertoire names a chain by what is in it, and the roadmap's own law is
  // that the names have to be authored against the eng-rate baseline rather
  // than invented. This is the measurement that comes first: the same xorshift
  // masher eng-rate6.js uses, six chapters, and every chain the ring holds
  // when a card is earned — plus every chain that closed without one, because
  // a pattern nobody ever gets near is a silhouette for ever.
  //
  // Entered with hud.cross, not switchTo (trap 36).
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(400, 400);
  await page.waitForTimeout(900);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(9000);

  await page.evaluate(() => {
    const g = window.__capy, W = window;
    W.__cards = [];
    W.__ev = [];
    W.__on = false;
    g.events.on('capy:incident', (p) => {
      if (!W.__on) return;
      W.__cards.push({ b: g.biome.current, n: p.n, tier: p.tier,
                       ev: (p.ev || []).map(e => e.k + ':' + e.t) });
    });
    // ...and every event that counted, whether or not it ever became a card
    const realRing = g.repRing;
    W.__tick = () => {
      const r = realRing();
      if (!W.__on) return;
      const sig = r.map(e => e.k + ':' + e.t).join(' ');
      if (sig && sig !== W.__last) { W.__last = sig; W.__ev.push(sig); }
    };
    W.__poll = setInterval(W.__tick, 120);
    W.__startDrive = seed => {
      const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft'];
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
      let s = seed | 0 || 1;
      const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
      const held = new Set();
      const iv = setInterval(() => {
        if (rnd() < 0.10) {
          const k = KEYS[(rnd() * KEYS.length) | 0];
          if (held.has(k)) { up(k); held.delete(k); } else { down(k); held.add(k); }
        }
      }, 16);
      W.__stopDrive = () => { clearInterval(iv); for (const k of held) up(k); };
    };
  });

  const NAMES = ['sydney', 'venice', 'goreme', 'quay', 'kowloon', 'manly'];
  const out = [];
  for (const name of NAMES) {
    await page.evaluate((n) => { window.__capy.hud.cross(n); }, name);
    await page.waitForTimeout(12000);
    await page.evaluate(() => {
      const W = window;
      W.__cards.length = 0; W.__ev.length = 0; W.__last = '';
      W.__on = true;
      W.__startDrive(24680 + Math.random() * 1000 | 0);
    });
    await page.waitForTimeout(60000);
    out.push(await page.evaluate(() => {
      window.__on = false;
      window.__stopDrive();
      return { b: window.__capy.biome.current,
               cards: window.__cards.slice(),
               ev: window.__ev.slice() };
    }));
  }
  await page.evaluate((o) => fetch('/shot?name=q1-chains.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))),
  }), { rows: out, errs });
}
