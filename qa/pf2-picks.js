async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  await page.keyboard.press('Digit1');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3500)));
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('Enter');
    await page.evaluate(() => new Promise(r => setTimeout(r, 650)));
    await page.keyboard.press('KeyK');
    await page.evaluate(() => new Promise(r => setTimeout(r, 400)));
    await page.keyboard.down('KeyD');
    await page.evaluate(() => new Promise(r => setTimeout(r, 800)));
    await page.keyboard.up('KeyD');
  }
  const took = await page.evaluate(() => window.__capy.hud.albumAudit());
  // back to the TITLE CARD and do not start
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  const out = { took: took };
  out.title = await page.evaluate(() => {
    const arts = document.querySelectorAll('.capyui-pickart');
    const shots = document.querySelectorAll('.capyui-pickshot');
    let decoded = 0, broken = 0;
    shots.forEach(function (im) { if (im.naturalWidth > 0) decoded++; else broken++; });
    const first = shots[0];
    return { tiles: arts.length, withShot: shots.length, decoded: decoded, broken: broken,
             firstSrcHead: first ? String(first.src).slice(0, 22) : null,
             firstParentHasSvg: first ? !!first.parentNode.querySelector('svg') : null,
             keyBadgeStillThere: !!document.querySelector('.capyui-pickkey'),
             err: window.__capy && window.__capy.state.lastError ? String(window.__capy.state.lastError) : null };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-picks.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
