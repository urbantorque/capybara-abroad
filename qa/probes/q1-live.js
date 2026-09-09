async page => {
  await page.waitForTimeout(2000);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2000);
  const out = {};
  // A REAL CHAIN, THROUGH THE REAL HANDLERS. The payloads are constructed —
  // knocking three specific props over with a masher is not reproducible — but
  // every gate they pass is the game's own: the speed gate, `disturbed`, the
  // same-prop timer, the did-anybody-see-it test and the twelve-second window.
  out.live = await page.evaluate(async () => {
    const g = window.__capy;
    const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
    g.biome.switchTo('venice');
    tick(120);
    // stand where people are, or nothing counts at all
    const f = g.palAudit().found.filter(x => x.b === 'venice')[0];
    g.capy.body.position.set(f.x + 3, g.venice.terrainHeight(f.x + 3, f.z) + 0.4, f.z);
    g.capy.body.velocity.set(0, 0, 0);
    tick(60);
    const cards = [];
    const said = [];
    const seen = new MutationObserver(() => {});
    g.events.on('capy:incident', (p) => cards.push({ n: p.n, tier: p.tier, ev: (p.ev || []).map(e => e.k + ':' + e.t) }));
    for (const L of (g.locals || [])) {
      if (L.biome !== 'venice' || !L.anchor || L.anchor.__w) continue;
      const real = L.anchor.speak;
      L.anchor.speak = function (t) { said.push(t); return real.call(this, t); };
      L.anchor.__w = 1;
    }
    const cp = g.capy.position;
    const at = { x: cp.x, y: cp.y, z: cp.z };
    const fire = (kind, type, id) => {
      if (kind === 'spill') {
        g.events.emit('prop:impact', { position: at, speed: 0, spill: true,
                                       prop: { id: id, type: type, disturbed: true } });
      } else if (kind === 'bang') {
        g.events.emit('prop:impact', { position: at, speed: 5.5,
                                       prop: { id: id, type: type, disturbed: true } });
      } else if (kind === 'water') {
        g.events.emit('prop:water', { position: at,
                                      prop: { id: id, type: type, disturbed: true,
                                              body: { position: at } } });
      } else if (kind === 'break') {
        g.events.emit('prop:destroy', { prop: { id: id, type: type, disturbed: true,
                                                body: { position: at } } });
      }
    };
    // THE FLAT WHITE: a spilt coffee and two other things.
    fire('spill', 'coffee', 901); tick(20);
    fire('bang', 'bin', 902); tick(20);
    fire('bang', 'cone', 903); tick(30);
    const card = document.querySelector('.capyui-moment');
    const shot1 = { kick: card.querySelector('.capyui-momentkick').textContent,
                    text: card.querySelector('.capyui-momenttext').textContent,
                    note: card.querySelector('.capyui-momentnote').textContent,
                    noteShown: card.querySelector('.capyui-momentnote').style.display !== 'none',
                    shown: card.classList.contains('show') };
    const dbg1 = JSON.parse(JSON.stringify(g.repDebug()));
    // ...and now one that matches nothing, to prove the card falls back clean.
    tick(60 * 62);   // past sysINC_COOL, and the window has closed
    fire('bang', 'bin', 911); tick(20);
    fire('bang', 'cone', 912); tick(20);
    fire('bang', 'sign', 913); tick(30);
    const shot2 = { kick: card.querySelector('.capyui-momentkick').textContent,
                    text: card.querySelector('.capyui-momenttext').textContent,
                    note: card.querySelector('.capyui-momentnote').textContent,
                    noteShown: card.querySelector('.capyui-momentnote').style.display !== 'none' };
    return { cards, said, shot1, shot2, dbg1, dbg2: JSON.parse(JSON.stringify(g.repDebug())) };
  });
  // ...and it is on the file, and it comes back.
  out.saved = await page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('capy3.journey.v1')).rep; } catch (e) { return 'none'; }
  });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(2500);
  out.after = await page.evaluate(() => window.__capy.repDebug().counts);
  await page.evaluate((o) => fetch('/shot?name=q1-live.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
