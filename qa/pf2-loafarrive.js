async page => {
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 4500)));
  const out = { title: [], afterStart: [], afterWalk: [], notes: [] };
  // sample restT/loaf WHILE STILL ON THE TITLE CARD
  for (let i = 0; i < 3; i++) {
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { t: +(g.state.time || 0).toFixed(2), started: !!g.state.started,
               restT: g.capy ? +(g.capy.restT || 0).toFixed(2) : null,
               loaf: g.capy ? +(g.capy.loaf || 0).toFixed(3) : null };
    });
    out.title.push(s);
    await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
  }
  await page.keyboard.press('Digit1');
  // sample immediately and then over the first six seconds in the world
  for (let i = 0; i < 7; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 900)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { t: +(g.state.time || 0).toFixed(2), started: !!g.state.started,
               restT: g.capy ? +(g.capy.restT || 0).toFixed(2) : null,
               loaf: g.capy ? +(g.capy.loaf || 0).toFixed(3) : null };
    });
    out.afterStart.push(s);
  }
  // now WALK, and confirm the loaf drops and recovers on the documented curve
  await page.keyboard.down('KeyW');
  await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
  const walking = await page.evaluate(() => {
    const g = window.__capy;
    return { restT: +(g.capy.restT || 0).toFixed(2), loaf: +(g.capy.loaf || 0).toFixed(3) };
  });
  await page.keyboard.up('KeyW');
  out.notes.push({ whileWalking: walking });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => new Promise(r => setTimeout(r, 1000)));
    const s = await page.evaluate(() => {
      const g = window.__capy;
      return { restT: +(g.capy.restT || 0).toFixed(2), loaf: +(g.capy.loaf || 0).toFixed(3) };
    });
    out.afterWalk.push(s);
  }
  const b = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=pf2-loafarrive.json', { method: 'POST', body: s }), b);
}
