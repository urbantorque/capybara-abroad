async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);

  // Wrap taskDone so every resolution is ATTRIBUTABLE, and sweep the DOM for
  // any bubble text, so a line that actually appears can be named.
  await page.evaluate(() => {
    const g = window.__capy;
    window.__asked = Object.create(null);
    const raw = g.taskDone;
    g.taskDone = function (id) { window.__asked[id] = (window.__asked[id] || 0) + 1; return raw.call(g, id); };
    window.__seen = Object.create(null);
    window.__sweep = () => {
      const all = document.querySelectorAll('span');
      for (const s of all) {
        const t = (s.textContent || '').trim();
        if (t.length > 3 && t.length < 90) window.__seen[t] = 1;
      }
    };
    window.__sweepT = setInterval(window.__sweep, 60);
  });

  const out = {};

  // ---- BEFORE: nothing ticked --------------------------------------------
  out.before = await page.evaluate(async () => {
    const g = window.__capy;
    window.__asked = Object.create(null); window.__seen = Object.create(null);
    // SWEEP INSIDE THE LOOP. A setInterval never fires while the whole soak
    // is one synchronous page.evaluate, so the first cut caught only whatever
    // bubble happened to be up on the last frame and read zero hits.
    for (let i = 0; i < 60 * 90; i++) { g.tick(1 / 60, false); if ((i & 7) === 0) window.__sweep(); }
    window.__sweep();
    return { asked: Object.keys(window.__asked).sort(),
             seen: Object.keys(window.__seen).length };
  });

  // ---- AFTER: tick five of Sydney's, and look for their lines -------------
  out.after = await page.evaluate(async () => {
    const g = window.__capy;
    for (const id of ['opera-stage', 'swim', 'steal-hat', 'seagull-chips', 'cafe-table']) {
      g.completeTask(id);
    }
    window.__seen = Object.create(null);
    for (let i = 0; i < 60 * 240; i++) { g.tick(1 / 60, false); if ((i & 7) === 0) window.__sweep(); }
    window.__sweep();
    const want = [
      'Did you see it on the steps? It was ON the steps.',
      'There’s one in the harbour. Swimming. Just swimming.',
      'Somebody’s lost a hat this morning.',
      'There were birds everywhere. EVERYWHERE.',
      'He was up on the stage. I’ve got the photo.',
      'He’s wearing somebody’s hat.',
      'He’s soaked. He did that to himself.',
      'Did you get a photo of the thing on the steps?',
      'I told you it would swim.',
      'I got four. All of them blurry.',
      'Something stood on our table. Stood on it.',
      'I’m not putting my bag down again.',
      'They warned us about the birds. They did not warn us about that.',
    ];
    return { hits: want.filter(w => window.__seen[w]),
             misses: want.filter(w => !window.__seen[w]),
             seen: Object.keys(window.__seen).length };
  });

  // ---- AND THE PLAZA, WHICH IS THE OTHER HALF OF THE SAME TABLE ---------
  out.pasto = await page.evaluate(async () => {
    const g = window.__capy;
    g.biome.switchTo('pasto');
    const sp = g.biome.spawnOf ? g.biome.spawnOf('pasto') : null;
    if (sp && g.capy && g.capy.body) {
      g.capy.body.position.set(sp.x, sp.y + 0.6, sp.z);
      g.capy.body.velocity.setZero();
    }
    for (const id of ['condor-ride', 'steal-empanada', 'church-bell', 'market-chaos', 'coffee-scatter']) {
      g.completeTask(id);
    }
    window.__seen = Object.create(null); window.__asked = Object.create(null);
    // THE POOLS HAVE TO BE REACHED. Sitting at the spawn for four minutes drew
    // from paBroom and nothing else — the plaza cast, the church and the drying
    // patio all say what they say when the animal is standing in front of them.
    // Four stations, a minute each, and the census below names which pool each
    // one actually opened.
    // npcPA_STALLS puts the four market trestles at z 12 and the church at
    // npcPA_CHURCH (0, 44); the drying patio is npcPA_PATIO (46, 4). Standing
    // where each pool is actually spoken is the only way to sample it.
    const spots = [[-6, 14], [6, 14], [0, 42], [46, 4], [-18, 14], [18, 14]];
    for (let sIdx = 0; sIdx < spots.length; sIdx++) {
      if (g.capy && g.capy.body) {
        g.capy.body.position.set(spots[sIdx][0], 4, spots[sIdx][1]);
        g.capy.body.velocity.setZero();
      }
      for (let i = 0; i < 60 * 70; i++) { g.tick(1 / 60, false); if ((i & 7) === 0) window.__sweep(); }
    }
    const want = [
      'It went up with the condor. I watched it go.',
      'That is the one that took my neighbour’s empanada.',
      'It rang the bell. A chigüiro rang the bell.',
      'Third time this week. The third.',
      'And it eats the stock as well. Of course it does.',
      'We are still finding out who rang it.',
      'A whole year. And it walked straight through it.',
      'You went up with the bird. You still came back down here.',
    ];
    return { hits: want.filter(w => window.__seen[w]),
             misses: want.filter(w => !window.__seen[w]),
             asked: Object.keys(window.__asked).sort(),
             seen: Object.keys(window.__seen).length };
  });

  await page.evaluate(async (o) => {
    clearInterval(window.__sweepT);
    await fetch('/shot?name=v36-lines.json', {
      method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    });
  }, out);
}
