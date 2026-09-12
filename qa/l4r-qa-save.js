async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  // 1. play a little, tick a task through the game's own door, wait for the debounce
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  out.step1 = await page.evaluate(() => {
    const g = window.__capy;
    const ids = g.hud.taskIds(1);
    const id = ids[0];
    g.hud.completeTask(id);
    return { started: g.state.started, biome: g.biome.current, id, idsN: ids.length, done: g.hud.isTaskDone(id) };
  });
  await page.waitForTimeout(2500);
  out.raw1 = await page.evaluate(() => { const r = localStorage.getItem('capy3.journey.v1'); let o = null; try { o = JSON.parse(r); } catch (e) {} return { bytes: r ? r.length : 0, tasks: o && o.tasks, biome: o && o.biome, ms: o && o.ms, keys: o ? Object.keys(o) : null }; });
  // 2. go abroad, tick one there too, then hide the tab (the flush path) and reload
  await page.evaluate(() => window.__capy.hud.cross('kyoto'));
  await page.waitForTimeout(5000);
  out.step2 = await page.evaluate(() => {
    const g = window.__capy;
    const ids = g.hud.taskIds(4);
    g.hud.completeTask(ids[0]);
    return { biome: g.biome.current, id: ids[0], done: g.hud.isTaskDone(ids[0]) };
  });
  await page.waitForTimeout(100);
  // simulate the tab being hidden 100 ms after the tick, before the 700 ms debounce drains
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(200);
  out.raw2 = await page.evaluate(() => { const r = localStorage.getItem('capy3.journey.v1'); let o = null; try { o = JSON.parse(r); } catch (e) {} return { bytes: r ? r.length : 0, tasks: o && o.tasks, biome: o && o.biome, ms: o && o.ms, paused: window.__capy.state.paused }; });
  await page.reload();
  await page.waitForTimeout(6000);
  out.titleAfter = await page.evaluate(() => ({ btn: (document.querySelector('.capyui-go b') || {}).textContent, started: window.__capy.state.started }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  out.step3 = await page.evaluate((s) => {
    const g = window.__capy;
    return { started: g.state.started, biome: g.biome.current, done1: g.hud.isTaskDone(s.a), done2: g.hud.isTaskDone(s.b), tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null };
  }, { a: out.step1.id, b: out.step2.id });
  // 3. the settings card: copy then paste, clipboard stubbed
  await page.evaluate(() => {
    const store = { txt: '' };
    window.__clip = store;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { store.txt = t; return Promise.resolve(); }, readText: () => Promise.resolve(store.txt) } });
    window.confirm = () => true;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  out.pauseShown = await page.evaluate(() => window.__capy.hud.pauseShown());
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-setsave button')).map(b => b.textContent));
  out.saveButtons = btns;
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.capyui-setsave button')).find(x => /copy/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(600);
  out.copied = await page.evaluate(() => ({ note: (document.querySelector('.capyui-setsave .capyui-setnote') || {}).textContent, bytes: window.__clip.txt.length }));
  // alter the clipboard copy: add a third task done, then paste it back
  await page.evaluate(() => {
    const g = window.__capy; const o = JSON.parse(window.__clip.txt);
    const ids = g.hud.taskIds(2); o.tasks.push(ids[0]); o.__extra = ids[0];
    window.__clip.txt = JSON.stringify(o); window.__extraId = ids[0];
  });
  const extraId = await page.evaluate(() => window.__extraId);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('.capyui-setsave button')).find(x => /paste/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(400);
  out.pasted = await page.evaluate(() => ({ note: (document.querySelector('.capyui-setsave .capyui-setnote') || {}).textContent }));
  await page.waitForTimeout(5500);   // the paste path reloads itself after 600 ms
  await page.waitForTimeout(3000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  out.step4 = await page.evaluate((s) => {
    const g = window.__capy;
    return { started: g.state.started, biome: g.biome.current, done1: g.hud.isTaskDone(s.a), done2: g.hud.isTaskDone(s.b), doneExtra: g.hud.isTaskDone(s.c), tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null };
  }, { a: out.step1.id, b: out.step2.id, c: extraId });
  // 4. a corrupt file: unknown ids, wrong types, an unknown biome. Must still boot and start.
  await page.evaluate(() => {
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ['nope', 42, null, 'x'], seen: ['a', 99], recs: { foo: 'bar', 'opera-climb': 'NaN' }, ms: 'lots', chapms: [1, 2], finds: 7, foundAt: 'x', inc: null, biome: 'atlantis', pho: -1, rep: 'y', pal: [], wear: 3 }));
  });
  await page.reload();
  await page.waitForTimeout(6000);
  out.corruptTitle = await page.evaluate(() => ({ running: !!window.__capyRunning, btn: (document.querySelector('.capyui-go b') || {}).textContent, err: window.__capy && window.__capy.state.lastError }));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(4000);
  out.corrupt = await page.evaluate(() => { const g = window.__capy; return { started: g.state.started, biome: g.biome.current, tasksDone: g.hud.tasksDone(), lastError: g.state.lastError || null, pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }; });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  out.corruptWalk = await page.evaluate(() => { const g = window.__capy; return { pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)], lastError: g.state.lastError || null }; });
  // 5. a file that is not JSON at all
  await page.evaluate(() => { localStorage.setItem('capy3.journey.v1', '{not json'); });
  await page.reload();
  await page.waitForTimeout(6000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3500);
  out.notJson = await page.evaluate(() => { const g = window.__capy; return { running: !!window.__capyRunning, started: g.state.started, biome: g.biome.current, lastError: g.state.lastError || null }; });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4r-qa-save.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
