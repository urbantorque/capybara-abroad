async page => {
  // ---- THE STRING SHIPS IN THE ONE-FILE BUILD (L4, qa #3) -----------------
  // Shape of qa/l4r-qa-ks.js. Run `node build.mjs` first: this opens the
  // artefact from file://, where the Blob URL failed (AbortError) and the
  // fallback recipe played in silence. Three rows:
  //   fileSydney  Enter on the title, sixty seconds — ks true from file://
  //   fileRio     chapter 6 from the picker, twenty-five seconds — a pluck
  //               actually went through the string (ksN > 0), as l3-ks.js
  //               measured on http
  //   httpSydney  the same build's source over http, for the pair
  const out = {};
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e).slice(0, 200)));
  const read = () => page.evaluate(() => {
    const g = window.__capy; const a = g.musAudit(); const b = g.hud.audioBuses();
    return { proto: location.protocol, biome: g.biome.current, started: g.state.started,
             ks: a.ks, ksN: a.ksN, throws: a.throws, ctx: b && b.ac && b.ac.state,
             hasWorklet: !!(b && b.ac && b.ac.audioWorklet), lastError: g.state.lastError || null };
  });
  const dist = 'file:///C:/Users/roger/OneDrive/Desktop/capy3/dist/untitled-capybara-game.html';
  await page.goto(dist);
  await page.waitForTimeout(7000);
  await page.keyboard.press('Enter');
  for (let i = 0; i < 6; i++) await page.waitForTimeout(10000);
  out.fileSydney = await read();
  await page.goto(dist);
  await page.waitForTimeout(7000);
  await page.keyboard.press('Digit6');
  await page.waitForTimeout(25000);
  out.fileRio = await read();
  // 'commit' rather than 'load': the http page's load event waits on six
  // megabytes of modules behind whatever else the shared server is serving,
  // and the game is up long before it fires.
  await page.goto('http://localhost:5188/', { waitUntil: 'commit', timeout: 90000 });
  await page.waitForTimeout(9000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(15000);
  out.httpSydney = await read();
  out.errs = errs.slice(0, 8);
  out.pass = out.fileSydney.ks === true && out.fileRio.ks === true && out.fileRio.ksN > 0 && out.httpSydney.ks === true;
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-ks.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (!out.pass) throw new Error('l4-ks FAILED: ' + JSON.stringify(out));
}
