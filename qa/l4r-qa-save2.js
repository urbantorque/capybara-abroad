async page => {
  const out = {};
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  // A. the paste path, watched between the write and the reload
  await page.evaluate(() => {
    const store = { txt: '' };
    window.__clip = store;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { store.txt = t; return Promise.resolve(); }, readText: () => Promise.resolve(store.txt) } });
    window.confirm = () => true;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.capyui-setsave button')).find(x => /copy/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(500);
  out.before = await page.evaluate(() => { const g = window.__capy; const o = JSON.parse(localStorage.getItem('capy3.journey.v1')); return { started: g.state.started, tasks: o.tasks.length, biome: o.biome, clipBytes: window.__clip.txt.length }; });
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
  out.resumed = await page.evaluate((ids) => { const g = window.__capy; return { biome: g.biome.current, extraA: g.hud.isTaskDone(ids[0]), extraB: g.hud.isTaskDone(ids[1]), tasksDone: g.hud.tasksDone() }; }, extraId);
  // B. corrupt files, planted by an init script that fires once per key
  const plant = async (key, val) => {
    await page.addInitScript(({ key, val }) => {
      try { if (!sessionStorage.getItem('l4plant-' + key)) { sessionStorage.setItem('l4plant-' + key, '1'); localStorage.setItem('capy3.journey.v1', val); } } catch (e) {}
    }, { key, val });
  };
  await plant('c1', JSON.stringify({ v: 1, tasks: ['nope', 42, null, 'x', 'wheek'], seen: ['a', 99], recs: { foo: 'bar', 'opera-climb': 'NaN' }, ms: 'lots', chapms: [1, 2], finds: 7, foundAt: 'x', inc: null, biome: 'atlantis', pho: -1, rep: 'y', pal: [], wear: 3 }));
  await page.reload();
  await page.waitForTimeout(6000);
  out.c1title = await page.evaluate(() => ({ running: !!window.__capyRunning, btn: (document.querySelector('.capyui-go b') || {}).textContent, raw: (localStorage.getItem('capy3.journey.v1') || '').slice(0, 60) }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  out.c1 = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current, tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)], paperRows: document.querySelectorAll('.capyui-todo .capyui-txt').length }; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  out.c1walk = await page.evaluate(() => { const g = window.__capy; return { pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)], lastError: g.state.lastError || null, ledger: (document.querySelector('.capyui-jr-time, .capyui-jrtime') || {}).textContent || null }; });
  await plant('c2', '{not json');
  await page.reload();
  await page.waitForTimeout(6000);
  out.c2title = await page.evaluate(() => ({ running: !!window.__capyRunning, btn: (document.querySelector('.capyui-go b') || {}).textContent, raw: (localStorage.getItem('capy3.journey.v1') || '').slice(0, 30), bad: (localStorage.getItem('capy3.journey.bad') || '').slice(0, 30) }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  out.c2 = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current, tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null }; });
  await plant('c3', JSON.stringify({ v: 1, tasks: [], biome: 'kowloon', ms: 1e12 }));
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  out.c3 = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current, tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null }; });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-save2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
