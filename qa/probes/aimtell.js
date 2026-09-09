async page => {
  await page.mouse.click(400, 400);
  await page.waitForTimeout(1500);
  const out = {};
  for (const b of ['drift','kowloon','goreme','palawan','sydney']) {
    await page.evaluate((name) => {
      const g = window.__capy;
      g.biome.switchTo(name);
      const sp = g.biome.spawnOf(name), bd = g.capy.body;
      bd.position.set(sp.x, sp.y, sp.z); bd.velocity.set(0,0,0);
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position);
    }, b);
    await page.waitForTimeout(1200);
    const rows = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('f');
      await page.waitForTimeout(420);
      const r = await page.evaluate(() => {
        const on = document.querySelector('.capyui-aim.on');
        const li = on && on.closest('li');
        return on ? { t: li.querySelector('.capyui-txt').textContent, d: on.textContent } : null;
      });
      if (r) rows.push(r.t.slice(0,34) + '  ->  ' + r.d);
    }
    out[b] = rows;
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=aimtell.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o,null,1)))) }); }, out);
}
