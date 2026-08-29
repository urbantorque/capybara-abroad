async page => {
  const TAP = () => {
    const g = window.__capy;
    const b = g.music.bus;
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

  // The title card takes a digit directly and starts the game there — see the
  // sysPickFromKey branch in the keydown handler. One reload per chapter is the
  // only honest way in: the journal is a read-only book, not a departures board,
  // and jrTravel refuses without jrDepart.
  const KEYS = ['Digit1', 'Digit5', 'Digit9', 'Equal', 'Semicolon', 'Quote', 'Comma', 'Slash'];
  const rows = [];
  for (let i = 0; i < KEYS.length; i++) {
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(9500);
    const tapped = await page.evaluate(TAP);
    if (tapped !== 'ok') { rows.push({ key: KEYS[i], fail: tapped }); continue; }
    const r = await page.evaluate(k => new Promise(res => {
      const g = window.__capy;
      const out = { key: k, n: 0, rms: 0, peak: 0, corr: 0, side: 0, clip: 0 };
      let j = 0;
      const id = setInterval(() => {
        const s = window.__tapRead();
        out.n++; out.rms += s.rms; out.corr += s.corr; out.side += s.side;
        if (s.peak > out.peak) out.peak = s.peak;
        if (s.peak >= 0.999) out.clip++;
        if (++j >= 110) {
          clearInterval(id);
          out.rms = +(out.rms / out.n).toFixed(5);
          out.corr = +(out.corr / out.n).toFixed(3);
          out.side = +(out.side / out.n).toFixed(3);
          out.peak = +out.peak.toFixed(3);
          out.biome = g.biome.current;
          out.room = g.music.room;
          out.err = g.state.lastError ? String(g.state.lastError).slice(0, 160) : null;
          res(out);
        }
      }, 100);
    }), KEYS[i]);
    rows.push(r);
  }
  await page.evaluate(o => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))));
    return fetch('/shot?name=v41-rooms.json', { method: 'POST', body: s });
  }, rows);
  return true;
}
