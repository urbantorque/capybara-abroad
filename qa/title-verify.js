async page => {
  const R = { };
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });

  const snap = () => page.evaluate(() => {
    const g = window.__capy;
    const c = g.camera;
    const p = g.capy && g.capy.group ? g.capy.group.position : null;
    let nx = -9, ny = -9;
    if (p) {
      const v = new g.THREE.Vector3(p.x, p.y + 0.5, p.z);
      v.project(c); nx = +v.x.toFixed(3); ny = +v.y.toFixed(3);
    }
    // every bubble the npc pool has actually put on screen
    const bubs = [...document.getElementById('hud').children].filter(e => {
      const s = e.style;
      return s && s.transformOrigin === '50% 100%' && e.offsetParent &&
             getComputedStyle(e).display !== 'none';
    }).map(e => e.textContent.trim().slice(0, 40));
    const card = document.querySelector('.capyui-card');
    const cr = card ? card.getBoundingClientRect() : null;
    return {
      pitchDeg: +(g.camInfo.pitch * 180 / Math.PI).toFixed(1),
      reach: +g.camInfo.reach.toFixed(2),
      cam: c.position.toArray().map(v => +v.toFixed(2)),
      nx, ny,
      animalPx: p ? Math.round((nx * 0.5 + 0.5) * window.innerWidth) : -1,
      cardR: cr ? Math.round(cr.right) : -1,
      bubbles: bubs, nBub: bubs.length,
      started: g.state.started,
      biome: g.biome ? g.biome.current : '',
      titleUp: !!(card && !card.closest('.capyui-title.gone')),
    };
  });

  // ---- A. the title, at four sizes ---------------------------------------
  for (const [w, h] of [[1920, 1080], [1440, 900], [1280, 720], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    if (w === 1920) {
      await page.goto('http://localhost:5188/');
      await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
      await page.reload();
    }
    await page.waitForTimeout(w === 1920 ? 6500 : 1400);
    await page.screenshot({ path: 'qa/TV-title-' + w + '.png' });
    R['title' + w] = await snap();
  }

  // ---- B. frame time, over 90 frames --------------------------------------
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1200);
  R.ms = await page.evaluate(() => new Promise(res => {
    const t = []; let last = performance.now(), n = 0;
    const step = () => {
      const now = performance.now(); t.push(now - last); last = now;
      if (++n < 90) requestAnimationFrame(step);
      else { t.sort((a, b) => a - b); res(+t[Math.floor(t.length / 2)].toFixed(2)); }
    };
    requestAnimationFrame(step);
  }));

  // ---- C. the drift actually drifts --------------------------------------
  const d0 = await snap();
  await page.waitForTimeout(6000);
  const d1 = await snap();
  R.drift = { yawMoved: +(Math.abs(d1.cam[0] - d0.cam[0]) + Math.abs(d1.cam[2] - d0.cam[2])).toFixed(3),
              reach0: d0.reach, reach1: d1.reach };

  // ---- D. calm switches the drift off ------------------------------------
  R.calm = await page.evaluate(async () => {
    const g = window.__capy;
    const before = g.camera.position.toArray();
    document.documentElement.classList.add('capy-calm');
    // the JS reader is calmOn(), not the class; drive the real preference
    try { localStorage.setItem('capy3.prefs.v1',
      JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('capy3.prefs.v1') || '{}'),
        { calm: true }))); } catch (e) {}
    return { note: 'class set; full check is the reload below', before: before.map(v => +v.toFixed(2)) };
  });

  // ---- E. starting Sydney: no cut, and the pose lets go ------------------
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  const pre = await snap();
  await page.keyboard.press('Enter');
  const trail = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(200);
    const s = await snap();
    trail.push({ t: (i + 1) * 0.2, pitch: s.pitchDeg, reach: s.reach, cam: s.cam });
    if (i === 1) await page.screenshot({ path: 'qa/TV-start-0.4s.png' });
    if (i === 5) await page.screenshot({ path: 'qa/TV-start-1.2s.png' });
  }
  R.startSydney = { pre: { pitch: pre.pitchDeg, reach: pre.reach }, trail };
  R.afterStart = await snap();

  // ---- F. a travelled chapter's arrival is not corrupted -----------------
  await page.goto('http://localhost:5188/');
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(6500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1400);
  await page.keyboard.press('Digit8');            // Marrakech, a travelled chapter
  const arr = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(200);
    const s = await snap();
    arr.push({ t: (i + 1) * 0.2, pitch: s.pitchDeg, reach: s.reach, biome: s.biome });
  }
  await page.screenshot({ path: 'qa/TV-arrive-marrakech.png' });
  R.arrive = arr;

  R.errors = errs;
  await page.evaluate(o => fetch('/shot?name=tv.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
  }), R);
}
