async page => {
  const out = {};
  const probe = async (label) => {
    await page.waitForTimeout(7000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(6000);
    await page.keyboard.press('KeyQ');
    await page.waitForTimeout(8000);
    out[label] = await page.evaluate(() => {
      const g = window.__capy; const a = g.musAudit(); const b = g.hud.audioBuses();
      return { proto: location.protocol, ks: a.ks, ksN: a.ksN, ctx: b && b.ac && b.ac.state, hasWorklet: !!(b && b.ac && b.ac.audioWorklet), started: g.state.started, palette: a.pal || a.palette || null, plucks: a.plucks || a.pluckN || null, keys: Object.keys(a).slice(0, 40) };
    });
  };
  await page.goto('http://localhost:5188/');
  await probe('http');
  await page.goto('file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html');
  await probe('file');
  // try the worklet directly from file:// with a fresh context + a blob module
  out.direct = await page.evaluate(async () => {
    const ac = new AudioContext();
    try { await ac.resume(); } catch (e) {}
    const src = 'class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor("l4p", P);';
    let ok = null;
    try { await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'application/javascript' }))); ok = true; } catch (e) { ok = String(e); }
    const r = { state: ac.state, addModule: ok };
    try { ac.close(); } catch (e) {}
    return r;
  });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(3000);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-ks.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
