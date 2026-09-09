async page => {
  // ---------------------------------------------------------------------------
  // qa/w1-card.js — LOOK AT THE POSTCARD (W1)
  //
  // The composite is the one thing in this batch a number cannot judge: a
  // caption that overruns the card, a stamp on top of the animal's head and a
  // crop through its middle are all perfectly valid dataURLs. So the card is
  // composed in five states, written out as real PNGs, and looked at.
  //
  // What CAN be measured is measured beside them: the caption's rendered width
  // against the picture's, the size the shrink-to-fit settled on, and the two
  // rungs of the send chain. `qa/w1-premise.js` found the harness allows
  // clipboard.write and aborts navigator.share, so the rung a desktop player
  // actually gets is the rung this can prove.
  // ---------------------------------------------------------------------------
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  // RELOAD, THEN CLEAR, THEN RELOAD. A clear followed by a reload does not
  // empty the save: the reload's own pagehide flush writes the live journey
  // straight back, and the first cut of this probe opened with a Venice
  // regular already at tier 5 from the run before it.
  await page.reload();
  await page.waitForTimeout(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(8000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(600);

  const out = { errs: errs, cards: [] };
  // Five states, poorest first, so the fallbacks are seen as well as the prize.
  const STATES = [
    { name: 'bare',    biome: 'sydney' },
    { name: 'named',   biome: 'venice', fresh: true },
    { name: 'regular', biome: 'venice', pal: 5 },
    { name: 'famous',  biome: 'hanoi',  noto: [14, 8, 6] },
    { name: 'keeping', biome: 'kyoto',  keep: true, noto: [4, 2, 3] },
  ];
  for (const st of STATES) {
    const r = await page.evaluate(async (s) => {
      const g = window.__capy;
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.hud.forceRep({});
      g.hud.forceNoto(s.noto ? s.noto[0] : 0, s.noto ? s.noto[1] : 0,
                      s.noto ? s.noto[2] : 1, 0, 0);
      // ...via somewhere else, always. A switchTo to the biome you are
      // already in fires no crossing, so state 3 kept state 2's fresh name
      // and captioned Venice with Venice's own stunt — correct behaviour,
      // wrong measurement.
      g.biome.switchTo(s.biome === 'sydney' ? 'kyoto' : 'sydney');
      tick(60 * 3);
      g.biome.switchTo(s.biome);
      tick(60 * 14);
      // ...and stand the animal somewhere a photograph can be taken of it. A
      // switchTo drops it wherever the spawn is and the first cut photographed
      // a capybara's ears at water level in a canal, which is a probe artefact
      // and not a postcard.
      try {
        const c = g.capy, b = g.biome.current;
        const mod = g[b];
        if (mod && mod.terrainHeight) {
          const p = c.position;
          c.body.position.set(p.x, mod.terrainHeight(p.x, p.z) + 0.5, p.z);
          c.body.velocity.set(0, 0, 0);
          tick(90);
        }
      } catch (e) {}
      // a named stunt has to be RECENT for the caption to claim it, so it is
      // caused rather than forced: three witnessed props inside the window.
      if (s.fresh) {
        const cp = g.capy.position;
        const at = { x: cp.x, y: cp.y, z: cp.z };
        g.events.emit('prop:impact', { position: at, speed: 0, spill: true,
                                       prop: { id: 901, type: 'coffee', disturbed: true } });
        tick(20);
        g.events.emit('prop:impact', { position: at, speed: 5.5,
                                       prop: { id: 902, type: 'bin', disturbed: true } });
        tick(20);
        g.events.emit('prop:impact', { position: at, speed: 5.5,
                                       prop: { id: 903, type: 'cone', disturbed: true } });
        tick(30);
      }
      // the regular's tier goes on the SAVE, because photoLine reads jrChapPal
      // and not npc.js's live tier. One warming is one tier.
      for (let k = 0; k < (s.pal || 0); k++) {
        try { g.events.emit('pal:warm'); } catch (e) {}
      }
      // ...and a souvenir is a FINISHED chapter, which is the only way to hold
      // one: keepHeld is chapComplete and nothing else.
      if (s.keep) {
        // `palDebug().here` is todoChapter() — the live chapter's number — so
        // the right chapter is asked for rather than looked up in a table of
        // nineteen literals that goes stale the moment one is renamed.
        const here = g.palDebug().here;
        for (const id of g.hud.taskIds(here)) {
          try { g.hud.completeTask(id); } catch (e) {}
        }
        tick(120);
      }
      tick(30);
      const url = g.cardDebug();
      const line = g.cardDebug('line');
      // ...and how the caption actually set
      const m = g.cardDebug('fit');
      return { name: s.name, len: url.length, line: line, fit: m,
               noto: g.hud.notoAudit().tier, pal: g.palDebug(),
               repLast: g.repDebug().last };
    }, st);
    out.cards.push(r);
    await page.evaluate((nm) => {
      const u = window.__capy.cardDebug();
      return fetch('/shot?name=W1-' + nm, { method: 'POST', body: u.split(',')[1] });
    }, st.name);
  }

  // ---- the chain -----------------------------------------------------------
  out.chain = await page.evaluate(async () => {
    const g = window.__capy;
    const url = g.cardDebug();
    const i = url.indexOf(',');
    const bin = atob(url.slice(i + 1));
    const arr = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) arr[k] = bin.charCodeAt(k);
    const blob = new Blob([arr], { type: 'image/png' });
    const res = { bytes: blob.size };
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      res.clipboard = 'ok';
    } catch (e) { res.clipboard = String(e).slice(0, 100); }
    return res;
  });

  out.errN = errs.length;
  await page.evaluate((o) => fetch('/shot?name=w1-card.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), out);
}
