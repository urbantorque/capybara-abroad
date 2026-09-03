async page => {
  // ======================================================================
  // THE D7/D8 COVERAGE SWEEP — nineteen chapters, six channels.
  //
  // D7 and D8 were both measured where they were BUILT: the hang in Son Doong
  // and Sydney, the flock in the piazza, the beat in Kyoto, the act light in
  // Monaco, the gesture in Sydney, the herd in the Pantanal. Every one of the
  // named bugs in this repository's memory is the same shape — a system
  // verified in one chapter and dead in eighteen — so this asks all six
  // questions of all nineteen.
  //
  // WHAT EACH ROW HAS TO SHOW, and why it is not an instantaneous read:
  //  - hang: a pendulum passes through zero, so a single sample of |ax|+|az|
  //    is a coin toss. maxA is the maximum over a ten-second window.
  //  - beat: swings is counted from a reset, over the same window.
  //  - flock: registered kinds, and whether each can be scared and fed.
  //  - act: the live act, and whether this chapter HAS a delta row (eleven
  //    deliberately do not — see CONTRACT.md, WORLD LIFE).
  //  - amb: anchored ambient voices, and how many resolved.
  //  - face: the star's mood channel is alive everywhere or nowhere, so it is
  //    read once per chapter as a canary on the pose stack running at all.
  // ======================================================================
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);

  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} });
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto('http://localhost:5188/');
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);

  const ALL = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara',
               'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
               'cave', 'antarctic', 'monaco', 'hanoi'];
  const rows = [];

  for (let i = 0; i < ALL.length; i++) {
    await page.evaluate(function (name) {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), b = g.capy.body;
      if (sp) { b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0); }
      return true;
    }, ALL[i]);
    await wait(2500);

    // start the samplers, and reset the two counters that count over a window
    await page.evaluate(function () {
      const g = window.__capy;
      try { g.beatAudit(true); } catch (e) {}
      try { g.flockDebug(true); } catch (e) {}
      const w = window.__cov = { maxA: {}, awake: 0, n: 0 };
      window.__covT = setInterval(function () {
        w.n++;
        try {
          const h = g.hangAudit();
          for (let j = 0; j < h.rows.length; j++) {
            const r = h.rows[j], k = r.voice + '@' + r.x + ',' + r.z;
            if (!(k in w.maxA) || r.a > w.maxA[k]) w.maxA[k] = r.a;
            if (!r.asleep) w.awake++;
          }
        } catch (e) { w.err = String(e); }
      }, 100);
      return true;
    });
    await wait(10000);

    rows.push(await page.evaluate(function (name) {
      const g = window.__capy;
      clearInterval(window.__covT);
      const w = window.__cov;
      const safe = f => { try { return f(); } catch (e) { return { ERR: String(e) }; } };
      const h = safe(() => g.hangAudit());
      const b = safe(() => g.beatAudit());
      const f = safe(() => g.flockDebug());
      const a = safe(() => g.actLight());
      const m = safe(() => g.ambAnchors());
      const an = safe(() => g.capy.animAudit());
      const ks = Object.keys(w.maxA);
      let peak = 0;
      for (const k of ks) if (w.maxA[k] > peak) peak = w.maxA[k];
      return {
        n: name, biome: g.biome.current,
        hang: { here: h.here, air: h.air, peakA: +peak.toFixed(4),
                stillest: ks.length ? +Math.min.apply(null, ks.map(k => w.maxA[k])).toFixed(4) : null,
                awakeFrac: w.n ? +(w.awake / (w.n * Math.max(1, h.here))).toFixed(2) : 0 },
        beat: { withJob: b.withJob, running: b.running,
                swings: (b.rows || []).reduce((s, r) => s + r.swings, 0),
                busy: (b.rows || []).filter(r => r.busy).length },
        flock: { kinds: (f.kinds || []).length,
                 birds: (f.kinds || []).reduce((s, r) => s + r.n, 0),
                 canScare: (f.kinds || []).filter(r => r.canScare).length,
                 canFeed: (f.kinds || []).filter(r => r.canFeed).length },
        act: { chapter: a.chapter, act: a.act, acts: a.acts, row: a.row, k: a.k },
        amb: { rows: (m.rows || []).length, ok: (m.rows || []).filter(r => r.ok).length,
               bad: (m.rows || []).filter(r => !r.ok).map(r => r.voice) },
        face: { mood: an.mood, blink: an.blink },
        err: g.state.lastError ? String(g.state.lastError) : null
      };
    }, ALL[i]));
  }

  const out = { rows: rows };
  const bl = await page.evaluate(o =>
    btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=d10-cover.json', { method: 'POST', body: s }), bl);
}
