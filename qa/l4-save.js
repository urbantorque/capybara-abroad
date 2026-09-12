async page => {
  // ---- THE PASTED JOURNEY SURVIVES ITS OWN RELOAD (L4, qa #2) -------------
  // Adapted from qa/l4r-qa-save2.js part A. No localStorage.clear() in an
  // init script: the whole point is what survives a reload. The journey is
  // seeded here with three ticks so "copy" has a file to copy; the review's
  // session happened to have one already.
  //   before      the seeded file, as copied to the (stubbed) clipboard
  //   afterClick  350 ms after "paste": the pasted file is on disk
  //   afterReload after the reload the paste schedules: STILL the pasted file
  //   resumed     Enter on the title: the two imported ticks are done and the
  //               chapter is the pasted one
  //   startOver   "start over" on the title card wipes to a fresh file, not
  //               back to the pasted one and not to the pre-paste one
  const out = {};
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const g = window.__capy;
    const ids = g.hud.taskIds(1);
    for (let i = 0; i < 3; i++) g.completeTask(ids[i]);
    const store = { txt: '' };
    window.__clip = store;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { store.txt = t; return Promise.resolve(); }, readText: () => Promise.resolve(store.txt) } });
    window.confirm = () => true;
  });
  await page.waitForTimeout(1500);   // sysSAVE_DEBOUNCE is 700 ms
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.capyui-setsave button')).find(x => /copy/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(500);
  out.before = await page.evaluate(() => { const g = window.__capy; const o = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { started: g.state.started, paused: g.state.paused, tasks: o.tasks.length, biome: o.biome, clipBytes: window.__clip.txt.length }; });
  const extraId = await page.evaluate(() => {
    const g = window.__capy; const o = JSON.parse(window.__clip.txt);
    // a journey from another machine: two more chapters' first tasks done, and a different chapter
    const a = g.hud.taskIds(2)[0], b = g.hud.taskIds(3)[0];
    o.tasks.push(a, b); o.biome = 'pasto'; o.marker = 'PASTED';
    window.__clip.txt = JSON.stringify(o); return [a, b];
  });
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.capyui-setsave button')).find(x => /paste/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(350);
  out.afterClick = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { note: (document.querySelector('.capyui-setsave .capyui-setnote') || {}).textContent, tasks: o.tasks.length, biome: o.biome, marker: o.marker || null }; });
  // the reload the paste path schedules fires at +600 ms; pagehide runs saveFlush
  await page.waitForTimeout(7000);
  out.afterReload = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { tasks: o.tasks.length, biome: o.biome, marker: o.marker || null, started: window.__capy.state.started }; });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  out.resumed = await page.evaluate((ids) => { const g = window.__capy; return { biome: g.biome.current, extraA: g.hud.isTaskDone(ids[0]), extraB: g.hud.isTaskDone(ids[1]), tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null }; }, extraId);
  // ---- and "start over" ---------------------------------------------------
  // Back to the title through the pause card's own door (flush + reload),
  // then the start-over row: the file must come out fresh, not the pasted
  // one and not the pre-paste one.
  await page.reload();
  await page.waitForTimeout(6000);
  out.titleAgain = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); return { tasks: o ? o.tasks.length : null, marker: o ? (o.marker || null) : null, overBtn: !!document.querySelector('.capyui-overbtn') }; });
  await page.evaluate(() => {
    // the start-over row lives on page two of the title card
    const ov = document.querySelector('.capyui-overbtn'); if (ov) ov.click();
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const y = document.querySelector('.capyui-overyes'); if (y) y.click(); });
  await page.waitForTimeout(4000);
  out.startOver = await page.evaluate(() => { const g = window.__capy; const raw = localStorage.getItem('capy3.journey.v1'); const o = raw ? JSON.parse(raw) : null; return { started: g.state.started, biome: g.biome.current, tasksDone: g.hud.tasksDone(), fileTasks: o ? o.tasks.length : null, fileMarker: o ? (o.marker || null) : null, lastError: g.state.lastError || null }; });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  out.pass = out.afterReload.marker === 'PASTED' && out.afterReload.tasks === out.afterClick.tasks &&
    out.resumed.extraA && out.resumed.extraB && out.resumed.biome === 'pasto' &&
    out.startOver.fileMarker !== 'PASTED' && out.startOver.tasksDone === 0;
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-save.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
  if (!out.pass) throw new Error('l4-save FAILED: ' + JSON.stringify(out));
}
