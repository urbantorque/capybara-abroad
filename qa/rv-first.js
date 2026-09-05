async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(7000);
  await page.screenshot({ path: 'qa/RV-title-p1.png' });
  await page.keyboard.press('ArrowRight');
  await wait(1500);
  await page.screenshot({ path: 'qa/RV-title-p2.png' });
  await page.keyboard.press('ArrowLeft');
  await wait(1200);

  // A stranger presses Enter and then does NOTHING for 75 seconds.
  const log = [];
  await page.evaluate(() => {
    window.__rvlog = [];
    const t0 = performance.now();
    const seen = new Set();
    const mo = new MutationObserver(() => {
      const els = document.querySelectorAll('.capyui-toasts *, .capyui-toast, .capyui-clue, .capyui-todo, .capyui-todo *');
      for (const el of els) {
        const tx = (el.textContent || '').trim();
        if (!tx || tx.length > 200) continue;
        const key = el.className + '|' + tx;
        if (seen.has(key)) continue;
        seen.add(key);
        window.__rvlog.push({ t: +((performance.now() - t0) / 1000).toFixed(1), cls: String(el.className).slice(0, 40), text: tx.slice(0, 160) });
      }
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    return true;
  });
  await page.keyboard.press('Enter');
  await wait(1200);
  await page.screenshot({ path: 'qa/RV-first-1s.png' });
  await wait(4000);
  await page.screenshot({ path: 'qa/RV-first-5s.png' });
  await wait(15000);
  await page.screenshot({ path: 'qa/RV-first-20s.png' });
  await wait(25000);
  await page.screenshot({ path: 'qa/RV-first-45s.png' });
  await wait(30000);
  await page.screenshot({ path: 'qa/RV-first-75s.png' });

  const state = await page.evaluate(() => {
    const g = window.__capy;
    const txt = s => Array.from(document.querySelectorAll(s)).map(e => (e.textContent || '').trim()).filter(Boolean);
    const vis = s => Array.from(document.querySelectorAll(s)).filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05; }).map(e => ({ cls: String(e.className).slice(0, 50), text: (e.textContent || '').trim().slice(0, 200), w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }));
    return {
      log: window.__rvlog,
      hudVisible: vis('#hud > *, .capyui > *').slice(0, 40),
      todo: txt('.capyui-todo'),
      clue: txt('.capyui-clue'),
      pos: g.capy && g.capy.position ? { x: +g.capy.position.x.toFixed(1), y: +g.capy.position.y.toFixed(1), z: +g.capy.position.z.toFixed(1) } : null,
      tasksDone: g.hud.tasksDone(),
      time: +g.state.time.toFixed(1),
      err: g.state.lastError ? String(g.state.lastError) : null,
    };
  });

  // Pause card, journal, departures.
  await page.keyboard.press('Escape');
  await wait(900);
  await page.screenshot({ path: 'qa/RV-pause.png' });
  const pauseTxt = await page.evaluate(() => Array.from(document.querySelectorAll('.capyui-pausecard *')).filter(e => e.children.length === 0).map(e => (e.textContent || '').trim()).filter(Boolean));
  await page.keyboard.press('Escape');
  await wait(600);
  await page.keyboard.press('Tab');
  await wait(900);
  await page.screenshot({ path: 'qa/RV-journal.png' });
  await page.keyboard.press('Escape');
  await wait(500);

  const out = { state, pauseTxt };
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=rv-first.json', { method: 'POST', body: s }), bl);
}
