// qa/l4-governor-ui.js — the governor's three faces (L4, E6 / qa #4): the
// once-only note after Begin, the settings-card row (auto · pretty · fast) and
// what picking a stop does to the rung at once, and the pf pref surviving a
// reload. Output qa/l4-governor-ui.json.png. Needs a machine slow enough to
// step down on its own (the harness is), or the note cannot be seen.
async page => {
  const out = {};
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5188/');
  await page.waitForTimeout(6000);
  await page.evaluate(() => {
    window.__l4t = { seen: 0, first: null };
    setInterval(() => {
      const t = (document.body.innerText || '').toLowerCase();   // notes render in caps
      if (t.indexOf('drawing a little less') >= 0) {
        if (!window.__l4t.first) window.__l4t.first = performance.now();
        window.__l4t.seen++;
      }
    }, 100);
  });
  out.rungAtTitle = await page.evaluate(() => window.__capy.perfAudit().rung);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(12000);
  out.afterBegin = await page.evaluate(() => ({ started: window.__capy.state.started, rung: window.__capy.perfAudit().rung,
    noteSeenTicks: window.__l4t.seen, noteFirstMs: window.__l4t.first }));
  // open the settings card and read the row
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);
  out.row = await page.evaluate(() => {
    const names = Array.from(document.querySelectorAll('.capyui-setname')).map(e => e.textContent);
    const i = names.indexOf('performance');
    const row = i >= 0 ? document.querySelectorAll('.capyui-setname')[i].parentElement : null;
    const rng = row ? row.querySelector('input[type=range]') : null;
    const val = row ? row.querySelector('.capyui-setval') : null;
    return { present: !!row, names, value: rng ? rng.value : null, label: val ? val.textContent : null,
             aria: rng ? rng.getAttribute('aria-valuetext') : null };
  });
  // pick 'pretty' (1) then 'fast' (2) through the input, as a hand would
  const pick = async (v) => {
    await page.evaluate((v) => {
      const names = Array.from(document.querySelectorAll('.capyui-setname'));
      const row = names.find(e => e.textContent === 'performance').parentElement;
      const rng = row.querySelector('input[type=range]');
      rng.value = String(v); rng.dispatchEvent(new Event('input', { bubbles: true }));
    }, v);
    await page.waitForTimeout(300);
    return page.evaluate(() => { const a = window.__capy.perfAudit(); return { mode: a.mode, rung: a.rung, dpr: a.dpr, shadow: a.shadow }; });
  };
  out.pretty = await pick(1);
  out.fast = await pick(2);
  out.auto = await pick(0);
  await pick(2);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1500);
  out.prefsRaw = await page.evaluate(() => { try { return localStorage.getItem('capy3.prefs.v1'); } catch (e) { return null; } });
  // the overlay line
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(600);
  out.overlayRung = await page.evaluate(() => { const e = document.querySelector('.capyui-perf'); const t = e ? e.textContent : ''; return (t.split('\n').find(l => l.indexOf('rung') === 0) || null); });
  await page.keyboard.press('Backquote');
  // reload WITHOUT clearing: pf must come back as 2 (fast) and pin rung 3
  await page.evaluate(() => { try { window.__capy.prefsFlush && window.__capy.prefsFlush(); } catch (e) {} });
  await page.waitForTimeout(500);
  const ctx = page.context();
  const page2 = await ctx.newPage();
  await page2.setViewportSize({ width: 1280, height: 720 });
  await page2.goto('http://localhost:5188/');
  await page2.waitForTimeout(6000);
  out.reload = await page2.evaluate(() => { const a = window.__capy.perfAudit(); return { mode: a.mode, rung: a.rung, dpr: a.dpr, shadow: a.shadow }; });
  await page2.close();
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l4-governor-ui.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
