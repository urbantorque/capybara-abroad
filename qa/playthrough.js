async page => {
  // A real play: trusted keys, real clock, real audio. Tick some tasks, use the
  // new keys while doing it, and check the card, the save and the score agree.
  await page.evaluate(() => { try { localStorage.removeItem('capy3.journey.v1'); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(4000);
  await page.mouse.click(400, 400);          // start Sydney
  await page.waitForTimeout(1800);
  const before = await page.evaluate(() => ({ done: window.__capy.state.score, biome: window.__capy.biome.current }));
  // wheek (a task), then chase a few props about
  await page.keyboard.press('q');
  await page.waitForTimeout(900);
  const seq = ['w', 'd', 'w', 'a', 's', 'd', 'w', 'w'];
  for (let i = 0; i < seq.length; i++) {
    await page.keyboard.down(seq[i]);
    await page.keyboard.down('Shift');
    await page.waitForTimeout(1400);
    await page.keyboard.up('Shift');
    await page.keyboard.up(seq[i]);
    await page.keyboard.press('e');
    await page.waitForTimeout(300);
    if (i === 2) { await page.keyboard.press('f'); await page.waitForTimeout(300); }
    if (i === 4) { await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); }
    if (i === 6) { await page.keyboard.down('r'); await page.waitForTimeout(900); await page.keyboard.up('r'); }
  }
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => {
    const g = window.__capy;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem('capy3.journey.v1') || 'null'); } catch (e) {}
    return {
      done: g.state.score,
      count: document.querySelector('.capyui-count').textContent,
      savedTasks: raw ? raw.tasks.length : -1,
      savedBiome: raw ? raw.biome : null,
      lastError: g.state.lastError || null,
      hudBare: document.getElementById('hud').classList.contains('bare'),
      pos: [+g.capy.position.x.toFixed(1), +g.capy.position.z.toFixed(1)],
    };
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=playthrough.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, { before, after });
}
