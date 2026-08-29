async page => {
  // THE DIFFERENTIAL. Two chapters, sampled the same way, so the same script can
  // be run against HEAD and against `git stash push -- src/systems.js` and the
  // two answers compared. A single green run proves nothing about whether the
  // mix moved; this is the only shape that does.
  //
  // Sydney is the reference (an ordinary pad chapter) and Son Doong is the
  // extreme (the wettest, longest room in the table). Writes qa/v41-ab.json.png.
  const TAP = () => {
    const g = window.__capy;
    // music.bus does not exist on the old build — fall back to the analyser on
    // nothing rather than guessing, and let the caller see the null.
    const b = (g.music && g.music.bus) ? g.music.bus : null;
    if (!b) return 'no bus';
    const ac = b.ac;
    const sp = ac.createChannelSplitter(2);
    b.out.connect(sp);
    const aL = ac.createAnalyser(); aL.fftSize = 2048; aL.smoothingTimeConstant = 0;
    const aR = ac.createAnalyser(); aR.fftSize = 2048; aR.smoothingTimeConstant = 0;
    sp.connect(aL, 0); sp.connect(aR, 1);
    const L = new Float32Array(2048), R = new Float32Array(2048);
    window.__tapRead = function () {
      aL.getFloatTimeDomainData(L);
      aR.getFloatTimeDomainData(R);
      let sl = 0, sr = 0, sc = 0, pk = 0, sm = 0, sd = 0;
      for (let i = 0; i < 2048; i++) {
        const l = L[i], r = R[i];
        sl += l * l; sr += r * r; sc += l * r;
        const m = (l + r) * 0.5, d = (l - r) * 0.5;
        sm += m * m; sd += d * d;
        const a = Math.abs(l) > Math.abs(r) ? Math.abs(l) : Math.abs(r);
        if (a > pk) pk = a;
      }
      const rl = Math.sqrt(sl / 2048), rr = Math.sqrt(sr / 2048);
      return {
        rms: (rl + rr) * 0.5, peak: pk,
        corr: (rl > 1e-7 && rr > 1e-7) ? sc / 2048 / (rl * rr) : 1,
        side: (sm + sd > 1e-12) ? sd / (sm + sd) : 0
      };
    };
    return 'ok';
  };

  const rows = [];
  const KEYS = ['Digit1', 'Quote'];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(9500);
    const tapped = await page.evaluate(TAP);
    if (tapped !== 'ok') { rows.push({ key: KEYS[i], fail: tapped }); continue; }
    await page.evaluate(() => {
      const g = window.__capy;
      const out = { n: 0, rms: 0, corr: 0, side: 0, peak: 0, clip: 0,
                    rmsMin: 9, rmsMax: 0, breathMin: 1, dips: 0 };
      let was = 1;
      window.__acc = out;
      window.__accId = setInterval(() => {
        const s = window.__tapRead();
        out.n++; out.rms += s.rms; out.corr += s.corr; out.side += s.side;
        if (s.peak > out.peak) out.peak = s.peak;
        if (s.peak >= 0.999) out.clip++;
        if (s.rms < out.rmsMin) out.rmsMin = s.rms;
        if (s.rms > out.rmsMax) out.rmsMax = s.rms;
        const br = (g.music && typeof g.music.breath === 'number') ? g.music.breath : 1;
        if (br < out.breathMin) out.breathMin = br;
        if (was >= 0.92 && br < 0.92) out.dips++;
        was = br;
      }, 100);
    });
    // 3 minutes, drained in short waits: one page.evaluate longer than ~25 s dies.
    for (let w = 0; w < 12; w++) await page.waitForTimeout(15000);
    rows.push(await page.evaluate(k => {
      clearInterval(window.__accId);
      const o = window.__acc, g = window.__capy;
      o.key = k;
      o.rms = +(o.rms / o.n).toFixed(5);
      o.corr = +(o.corr / o.n).toFixed(3);
      o.side = +(o.side / o.n).toFixed(3);
      o.peak = +o.peak.toFixed(3);
      o.rmsMin = +o.rmsMin.toFixed(5);
      o.rmsMax = +o.rmsMax.toFixed(5);
      o.breathMin = +o.breathMin.toFixed(3);
      o.range = +(o.rmsMax / Math.max(1e-6, o.rmsMin)).toFixed(1);
      o.biome = g.biome.current;
      o.room = (g.music && g.music.room !== undefined) ? g.music.room : '(none)';
      o.err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null;
      return o;
    }, KEYS[i]));
  }
  await page.evaluate(o => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
    return fetch('/shot?name=v41-ab.json', { method: 'POST', body: s });
  }, rows);
  return true;
}
