async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  const out = {};

  // ---- THE CONTROL, PROPERLY: a cone that genuinely reaches the basin -----
  await page.evaluate(() => {
    const g = window.__capy;
    try { g.hud.cross('monaco'); } catch (e) { g.biome.switchTo('monaco'); }
    return true;
  });
  await wait(9000);
  out.control = await page.evaluate(async () => {
    const g = window.__capy, api = g.monaco;
    const c0 = api.chicane();
    const cones = (g.props || []).filter(p => p.biome === 'monaco' && p.type === 'cone' && p.body &&
      Math.hypot(p.body.position.x - c0.x, p.body.position.z - c0.z) < 20);
    const p = cones[0], b = p.body;
    const capy = g.capy.body.position;
    const away = Math.hypot(capy.x - b.position.x, capy.z - b.position.z);
    // Drive it into the water HARD, and keep driving it until it is wet: the
    // basin is ten metres away and one impulse rolls short.
    let wet = false, tries = 0;
    while (!wet && tries < 14) {
      b.wakeUp();
      b.velocity.set(0, 2.0, 11.0);
      await new Promise(r => setTimeout(r, 700));
      if (b.position.y < -0.4) wet = true;
      tries++;
    }
    await new Promise(r => setTimeout(r, 2500));
    return { animalAway: +away.toFixed(1), tries: tries, wet: wet,
             coneY: +b.position.y.toFixed(2), coneZ: +b.position.z.toFixed(2),
             done: g.taskDone('chicane') };
  });

  // ---- THE CLOSING SENTENCE ARRIVES ALONE --------------------------------
  out.lastToast = await page.evaluate(async () => {
    const g = window.__capy;
    g.toast('an autosave pill', 'note');
    g.toast('a second pill', 'note');
    await new Promise(r => setTimeout(r, 400));
    const wrap = document.querySelector('.capyui-toasts');
    const before = Array.from(wrap.children).filter(e => !e.dataset.going).length;
    g.toast('and that is the lot.', 'last');
    await new Promise(r => setTimeout(r, 250));
    const live = Array.from(wrap.children).filter(e => !e.dataset.going)
      .map(e => (e.textContent || '').trim());
    return { liveBefore: before, liveAfter: live.length, texts: live };
  });

  // ---- THE MUTE ICON KEEPS ITS SIZE --------------------------------------
  await page.keyboard.press('Escape');
  await wait(900);
  out.mute = await page.evaluate(async () => {
    const btn = document.querySelector('.capyui-pausebtn');
    // open the settings block
    const all = Array.from(document.querySelectorAll('.capyui-pausebtn'));
    const set = all.find(b => /settings/i.test(b.textContent || ''));
    if (set) set.click();
    await new Promise(r => setTimeout(r, 500));
    const m = document.querySelector('.capyui-setmute');
    if (!m) return { error: 'no mute button' };
    const wrapR = m.getBoundingClientRect();
    const waveR = m.querySelector('.wave').getBoundingClientRect();
    m.click();
    await new Promise(r => setTimeout(r, 400));
    const crossEl = m.querySelector('.cross');
    const cs = getComputedStyle(crossEl);
    const crossR = crossEl.getBoundingClientRect();
    m.click();
    return { button: [Math.round(wrapR.width), Math.round(wrapR.height)],
             wave: [Math.round(waveR.width), Math.round(waveR.height)],
             cross: [Math.round(crossR.width), Math.round(crossR.height)],
             crossDisplay: cs.display };
  });
  await page.keyboard.press('Escape');
  await wait(600);

  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f1-gate2.json', { method: 'POST', body: s }), bl);
}
