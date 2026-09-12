async page => {
  await page.goto('file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const out = await page.evaluate(async () => {
    const ac = new AudioContext();
    try { await ac.resume(); } catch (e) {}
    const src = 'class P extends AudioWorkletProcessor { process() { return true; } } registerProcessor("l4p", P);';
    const r = { state: ac.state, ua: navigator.userAgent.slice(0, 80) };
    try { await ac.audioWorklet.addModule('data:application/javascript;base64,' + btoa(src)); r.data = true; } catch (e) { r.data = String(e); }
    try { await ac.audioWorklet.addModule('data:text/javascript,' + encodeURIComponent(src)); r.dataPlain = true; } catch (e) { r.dataPlain = String(e); }
    try { await ac.audioWorklet.addModule(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); r.blob = true; } catch (e) { r.blob = String(e); }
    try { ac.close(); } catch (e) {}
    return r;
  });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(3000);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-ks2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
