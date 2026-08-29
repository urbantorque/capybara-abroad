async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto('http://localhost:5199/index.html');
  await page.waitForTimeout(7000);
  // Cycle the pin through every open task in every chapter and record whether
  // the card can point at it at all. A task with no pointer and no beacon is a
  // task whose only guidance is one sentence of prose.
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  const names = ['cali', 'rio', 'iceland', 'sahara', 'drift'];
  const out = {};
  for (const b of names) {
    const n = await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), bd = g.capy.body;
      bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0, 0, 0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
      return document.querySelectorAll('.capyui-task:not(.capyui-hidden)').length;
    }, b);
    await page.waitForTimeout(1000);
    const seen = {};
    for (let i = 0; i < 22; i++) {
      const r = await page.evaluate(() => {
        const li = [...document.querySelectorAll('.capyui-task:not(.capyui-hidden)')]
          .find(x => x.querySelector('.capyui-aim').classList.contains('on'));
        const all = [...document.querySelectorAll('.capyui-task:not(.capyui-hidden)')];
        // the pinned row is the one the clue sits under
        const clue = document.querySelector('.capyui-clue');
        let pinned = null;
        for (const x of all) if (x.nextElementSibling === clue) pinned = x;
        return { pinned: pinned ? pinned.querySelector('.capyui-txt').textContent : null,
                 aim: !!li, clue: clue ? clue.textContent : '' };
      });
      if (r.pinned && seen[r.pinned] === undefined) seen[r.pinned] = { aim: r.aim, clue: r.clue.slice(0, 40) };
      await page.keyboard.press('f');
      await page.waitForTimeout(340);
    }
    out[b] = Object.keys(seen).filter(k => !seen[k].aim).map(k => k.slice(0, 40) + '  [' + seen[k].clue + ']');
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rb-ptr.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) });
  }, out);
}
