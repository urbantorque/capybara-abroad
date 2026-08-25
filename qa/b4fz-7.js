async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) { } });
  await page.goto('http://localhost:5188/index.html?b4fz7=1');
  await page.waitForTimeout(6000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(3000);
  const out = {};
  // A KEY IS A PRESS AND A RELEASE. systems.js latches `keys[c]` on keydown and
  // only clears it on keyup, so a probe that never lifts the key gets exactly
  // one press per key for the whole session and everything after looks dead.
  const K = async code => {
    await page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true })), code);
    await page.waitForTimeout(60);
    await page.evaluate(c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true })), code);
    await page.waitForTimeout(60);
  };
  const read = () => page.evaluate(() => {
    const ph = document.querySelector('.capyui-photo');
    const cap = document.querySelector('.capyui-pcap');
    const host = ph && ph.parentElement;
    let shots = -1, last = null;
    try {
      const o = JSON.parse(localStorage.getItem('capy3.album.v1') || '{}');
      const a = o.shots || []; shots = a.length;
      const s = a[a.length - 1]; if (s) last = { place: s.place, cap: s.cap, len: (s.u || '').length };
    } catch (e) { }
    return {
      show: !!(ph && ph.classList.contains('show')),
      bare: !!(host && host.classList.contains('bare')),
      cap: cap ? cap.textContent : null,
      biome: window.__capy.biome.current,
      done: !!document.querySelector('.capyui-done.show'),
      shots, last,
    };
  });
  out.base = await read();
  await K('KeyK'); out.open = await read();
  await K('Enter'); await page.waitForTimeout(500); out.shot1 = await read();
  await K('KeyK'); out.closed = await read();
  // ---- the DARK, the DIVE, the HELM, each entered WITH the camera out -----
  for (const st of [['dark', 'cave'], ['dive', 'palawan'], ['helm', 'antarctic']]) {
    await page.evaluate(s => {
      const g = window.__capy;
      g.biome.switchTo(s[1]);
      const sp = g.biome.spawnOf(s[1]), cb = g.capy.body;
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0);
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
      if (s[0] === 'dive') { g.capy.diving = true; g.capy.depth = 3.2; }
      if (s[0] === 'helm') { g.capy.atHelm = true; g.state.sailing = true; }
      for (let i = 0; i < 60; i++) g.tick(1 / 60, false);
    }, st);
    await K('KeyK'); const a = await read();
    await K('Enter'); await page.waitForTimeout(500); const b = await read();
    await K('KeyK'); const c = await read();
    out[st[0]] = { openedShow: a.show, cap: a.cap, biome: a.biome,
                   shotsBefore: a.shots, shotsAfter: b.shots, last: b.last,
                   closedShow: c.show, closedBare: c.bare };
  }
  await page.evaluate(() => {
    const g = window.__capy; g.capy.diving = false; g.capy.atHelm = false; g.state.sailing = false;
    g.biome.switchTo('sydney');
    const sp = g.biome.spawnOf('sydney'), cb = g.capy.body;
    cb.position.set(sp.x, sp.y, sp.z);
    cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position);
  });
  // ---- CROSS A BORDER WITH THE CAMERA OUT --------------------------------
  await K('KeyK'); out.openInSydney = await read();
  await page.evaluate(() => { window.__capy.biome.switchTo('venice'); for (let i = 0; i < 60; i++) window.__capy.tick(1 / 60, false); });
  await page.waitForTimeout(300);
  out.afterCross = await read();
  await K('Enter'); await page.waitForTimeout(500); out.shotAfterCross = await read();
  await K('KeyK'); out.closedAfterCross = await read();
  // ---- THE CEREMONY ------------------------------------------------------
  await page.evaluate(() => {
    window.__capy.biome.switchTo('sydney');
    const ids = ["wheek", "steal-hat", "coffee-spill", "picnic-thief", "bin-chicken", "dig-flower",
      "chased", "photo-op", "opera-stage", "ball-harbour", "swim", "hat-harbour", "cafe-table",
      "busker-hat", "dog-loose", "seagull-chips", "sprinkler", "ferry-ride", "whippy-run",
      "the-sprinkler", "the-queue"];
    for (const i of ids) window.__capy.completeTask(i);
  });
  await page.waitForTimeout(1400);
  out.ceremonyBefore = await read();
  await K('KeyK'); out.ceremonyOpen = await read();
  await K('Enter'); await page.waitForTimeout(500); out.ceremonyShot = await read();
  await page.waitForTimeout(3000); out.ceremonyLater = await read();
  await K('KeyK'); out.ceremonyClosed = await read();
  await page.evaluate(async o => {
    await fetch('/shot?name=b4fz-7.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out);
}
