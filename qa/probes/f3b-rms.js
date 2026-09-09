async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(4000);
  // Hang an analyser on the master, which is where everything audible is
  // summed. The gain PARAM moving proves the driver ran; it does not prove the
  // node is in the graph, and a dangling node is exactly the mistake that
  // would survive every other check in this file.
  await page.evaluate(() => {
    const b = window.__capy.music.bus;
    const an = b.ac.createAnalyser();
    an.fftSize = 2048;
    b.out.connect(an);
    window.__rms = () => {
      const a = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(a);
      let s = 0;
      for (let i = 0; i < a.length; i++) s += a[i] * a[i];
      return +Math.sqrt(s / a.length).toFixed(5);
    };
    return true;
  });
  const sample = (ms) => page.evaluate(function (m) { return new Promise(res => {
    const r = []; const g = window.__capy;
    const iv = setInterval(() => r.push({ rms: window.__rms(), g: +g.hud.mixAudit().scrapeG.toFixed(4),
                                          sl: !!g.capy.sliding }), 25);
    setTimeout(() => { clearInterval(iv); res(r); }, m);
  }); }, ms);
  const out = {};
  out.still = await sample(700);
  // run, then slide
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await wait(1700);
  out.running = await sample(400);
  await page.keyboard.down('KeyG');
  await wait(160);
  out.sliding = await sample(500);
  await page.keyboard.up('KeyG'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const mean = a => +(a.reduce((s, x) => s + x.rms, 0) / a.length).toFixed(5);
  const peak = a => Math.max.apply(null, a.map(x => x.rms));
  out.summary = {
    stillRms: mean(out.still), stillG: out.still[out.still.length - 1].g,
    runRms: mean(out.running),
    slideRms: mean(out.sliding), slidePeak: peak(out.sliding),
    slideG: Math.max.apply(null, out.sliding.map(x => x.g)),
    slidingFrames: out.sliding.filter(x => x.sl).length, of: out.sliding.length,
  };
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f3b-rms.json', { method: 'POST', body: s }), bl);
}
