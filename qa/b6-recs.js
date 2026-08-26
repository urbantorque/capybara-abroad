async page => {
  // ---- THE LIVE BEST, ON A SAVE THAT ALREADY HOLDS ONE -------------------
  // A fresh file has nothing to show, so a run on one proves nothing: the
  // question is whether a player who HAS a record for a run can see it while
  // making the next attempt. So the save is seeded with a value for every
  // measured id first, and the game is entered through CARRY ON rather than
  // through a picker digit — startGame's non-restore branch calls saveClear(),
  // which would wipe the seed before the first frame.
  //
  // The id list is DERIVED from the call sites in src/, never spelled here: an
  // audit that carries its own copy of the list goes stale the first time a
  // chapter is wired up and nobody notices.
  await page.reload();
  await page.waitForTimeout(5000);
  const ids = await page.evaluate(async () => {
    const files = ['systems', 'shared', 'environment', 'pasto', 'quay', 'kyoto', 'cali', 'rio',
                   'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                   'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi', 'npc', 'condor'];
    const found = {};
    for (const f of files) {
      const src = await (await fetch('/src/' + f + '.js', { cache: 'no-store' })).text();
      for (const m of src.matchAll(/\b(?:recordLive|antLive)\(\s*['"]([a-z-]+)['"]/g)) {
        (found[m[1]] = found[m[1]] || []).push(f);
      }
    }
    return found;
  });
  const idList = Object.keys(ids).sort();
  // seed, once, then ONE reload — never an addInitScript, which fires on every
  // navigation and would wipe the very file this test is about (harness trap 10)
  await page.evaluate((list) => {
    localStorage.clear();
    const recs = {};
    // a plausible standing best for each: the units differ, the point does not
    for (let i = 0; i < list.length; i++) recs[list[i]] = 7 + i * 0.5;
    localStorage.setItem('capy3.journey.v1', JSON.stringify({
      // TASKS MUST NOT BE EMPTY. jrFileCount is jrFile.tasks.length, and with
      // it at zero the title card offers "begin" rather than "carry on" —
      // Enter then takes startGame's NON-restore branch, which calls
      // saveClear() and wipes the very seed this test is about, before the
      // first frame. Measured: 28 rows reading "no best yet" on a file that
      // had a best for all 28.
      v: 1, tasks: ['wheek'], seen: [1], recs: recs, told: 1, ms: 60000,
      chapms: {}, finds: [], foundAt: {}, biome: 'sydney', fin: 0,
    }));
  }, idList);
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const rows = await page.evaluate(async (list) => {
    const g = window.__capy;
    const el = document.querySelector('.capyui-rec');
    const now = document.querySelector('.capyui-recnow');
    const best = document.querySelector('.capyui-recbest');
    const out = { started: g.state.started, rows: [] };
    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      // the opening call, with no figure: the standing best alone, which is
      // the target — then a figure, which is the attempt against it
      g.recordLive(id);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      const openNow = now.textContent, openUp = el.classList.contains('on');
      g.recordLive(id, 3.25);
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      out.rows.push({ id: id, up: openUp && el.classList.contains('on'),
                      openLine: openNow, liveNow: now.textContent, liveBest: best.textContent });
      g.recordEnd(id);
      await new Promise(r => requestAnimationFrame(r));
    }
    out.offAtEnd = !el.classList.contains('on');
    out.err = (g.state.lastError && String(g.state.lastError)) || '';
    return out;
  }, idList);
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b6-recs.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { sites: ids, result: rows });
}
