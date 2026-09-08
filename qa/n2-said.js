async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  const PLACES = ['venice', 'goreme', 'manly'];
  const rows = [];
  for (const b of PLACES) {
    const r = await page.evaluate(async (bi) => {
      const g = window.__capy;
      const PERCH = ['There is something on it.', 'Does it know?',
        'It has not moved. Neither has that.', 'How long has that been there?',
        'That is not its. That belongs to somebody.',
        'They are just going to stay like that, are they.',
        'I have so many questions.', 'Neither of them is bothered.'];
      const o = { biome: bi };
      const tick = (n) => { for (let i = 0; i < n; i++) g.tick(1 / 60, false); };
      g.completeTask('gather', true);
      g.biome.switchTo(bi);
      tick(150);
      // ---- STAND WHERE THE PEOPLE ARE, NOT WHERE THE ANIMALS ARE ---------
      // The first attempt picked the herd animal and walked to a person, and in
      // Venice the nearest person to pigeon zero is thirty metres — so the
      // teleport landed somewhere the loaf could not run and the whole probe
      // read as a dead reaction. The birds are everywhere and the people are
      // not: pick the spot from the people's side and let the wheek find birds.
      let photoN = 0;
      g.events.on('npc:photo', function () { photoN++; });
      const people = g.npcs.filter(n => n.group && n.kind !== 'ibis' && n.speak);
      // the densest six-metre neighbourhood of people in the chapter
      let bestP = null, bestN = -1;
      for (const p of people) {
        let n = 0;
        for (const q of people) {
          const d = Math.hypot(p.group.position.x - q.group.position.x,
                               p.group.position.z - q.group.position.z);
          if (d < 9) n++;
        }
        if (n > bestN) { bestN = n; bestP = p; }
      }
      if (!bestP) { o.err = 'nobody speaks here'; return o; }
      o.crowd = bestN;
      const at = { x: bestP.group.position.x + 6.2, z: bestP.group.position.z + 1.0 };
      const pin = () => {
        g.capy.body.position.x = at.x; g.capy.body.position.z = at.z;
        g.capy.body.velocity.set(0, 0, 0); g.capy.body.angularVelocity.set(0, 0, 0);
      };
      g.capy.body.position.set(at.x, bestP.group.position.y + 1.2, at.z);
      tick(1);
      for (let i = 0; i < 260; i++) { pin(); g.tick(1 / 60, false); }
      o.settle = { loaf: +g.capy.loaf.toFixed(2), rest: +g.capy.restT.toFixed(1),
                   grounded: g.capy.grounded, swim: g.capy.swimming };
      for (let w = 0; w < 6; w++) {
        pin();
        g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        for (let i = 0; i < 30; i++) { pin(); g.tick(1 / 60, false); }
      }
      o.led = g.herdDebug().kinds.map(k => k.kind + ':' + k.led).join(' ');
      const said = {};
      let onMax = 0;
      for (let i = 0; i < 60 * 100; i++) {
        pin();
        if (i > 0 && i % 600 === 0) g.events.emit('capy:wheek', { position: g.capy.position, soft: false });
        g.tick(1 / 60, false);
        if (i % 15 === 0) {
          if (g.perchCount() > onMax) onMax = g.perchCount();
          for (const n of g.npcs) {
            if (n.lastLine && PERCH.indexOf(n.lastLine) >= 0) said[n.lastLine] = 1;
          }
        }
      }
      o.onMax = onMax;
      o.photos = photoN;
      o.perchLines = Object.keys(said).length;
      o.which = Object.keys(said);
      o.loaf = +g.capy.loaf.toFixed(2);
      o.lastError = g.state.lastError || null;
      return o;
    }, b);
    rows.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=n2-said.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), rows);
}
