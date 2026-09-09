async page => {
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(3000);
  const out = { pre: null, ticks: [], post: null };
  out.pre = await page.evaluate(() => {
    const g = window.__capy;
    return { done: g.state.score, task: null, pos: { x: +g.capy.position.x.toFixed(1), z: +g.capy.position.z.toFixed(1) } };
  });
  // onto the podium deck: y = 1.2 exactly, inside operaStage x[-9,9] z[1.05,3.9]
  await page.evaluate(() => {
    const g = window.__capy;
    g.capy.body.position.set(0, 1.55, 2.4);
    g.capy.body.velocity.set(0, 0, 0);
    if (g.capy.body.previousPosition) g.capy.body.previousPosition.copy(g.capy.body.position);
    if (g.capy.body.interpolatedPosition) g.capy.body.interpolatedPosition.copy(g.capy.body.position);
  });
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(700);
    const s = await page.evaluate(() => {
      const g = window.__capy;
      const p = g.capy.position;
      const dx = p.x, dz = p.z - 2.4;
      if (dx * dx + dz * dz > 9 || p.y < 1.0) {
        g.capy.body.position.set(0, 1.55, 2.4); g.capy.body.velocity.set(0, 0, 0);
      }
      const toast = document.querySelector('.capyui-toast, [class*=toast]');
      return {
        y: +p.y.toFixed(2), x: +p.x.toFixed(1), z: +p.z.toFixed(1),
        score: g.state.score,
        chaos: +(g.state.chaos || 0).toFixed(2),
        toast: toast ? (toast.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) : null,
        card: (function () { const c = document.querySelector('.capyui-place, .capyui-done, .capyui-wow'); return c ? (c.textContent || '').trim().slice(0, 50) : null; })()
      };
    });
    out.ticks.push(s);
    if (s.score > out.pre.done) { out.firedAt = i; break; }
  }
  out.post = await page.evaluate(() => {
    const g = window.__capy;
    return { score: g.state.score, err: g.state.lastError ? String(g.state.lastError) : null,
             musLive: !!(g.music && g.music.live), musPlaying: !!(g.music && g.music.playing) };
  });
  await page.evaluate(o => fetch('/shot?name=pf2-marquee1.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
