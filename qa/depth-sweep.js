async page => {
  const KEYS = ['Digit1','Digit2','Digit3','Digit4','Digit5','Digit6','Digit7','Digit8','Digit9',
                'Digit0','Minus','Equal','BracketLeft','BracketRight','Semicolon','Quote',
                'Comma','Period','Slash'];
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < 19; i++) {
    await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await page.reload();
    await page.waitForTimeout(5200);
    await page.keyboard.press(KEYS[i]);
    await page.waitForTimeout(7000);
    const n2 = String(i + 1).padStart(2, '0');
    await page.screenshot({ path: 'qa/D45-' + n2 + '-' + NAMES[i] + '.png' });
    const row = await page.evaluate(() => new Promise(res => {
      const g = window.__capy;
      // A real rAF sample. This cannot see the DELTA of the depth terms (the
      // game is vsync-locked) but it is the only thing that answers the
      // question that actually matters: is it still a locked sixty.
      const t = [];
      let last = performance.now();
      function step() {
        const n = performance.now();
        t.push(n - last); last = n;
        if (t.length < 130) requestAnimationFrame(step);
        else {
          const s = t.slice(10).sort((a, b) => a - b);
          const p = g.post.params;
          res({ biome: g.biome && g.biome.current,
                med: +s[(s.length / 2) | 0].toFixed(2),
                p95: +s[(s.length * 0.95) | 0].toFixed(2),
                worst: +s[s.length - 1].toFixed(2),
                dof: p.dof, air: p.air, crease: p.crease,
                near: [+p.dofNear0.toFixed(1), +p.dofNear1.toFixed(1)],
                far: [+p.dofFar0.toFixed(1), +p.dofFar1.toFixed(1)],
                err: g.state.lastError || null });
        }
      }
      requestAnimationFrame(step);
    }));
    row.want = NAMES[i];
    out.push(row);
  }
  await page.evaluate(o => fetch('/shot?name=depthsweep.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
