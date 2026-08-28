async page => {
  const NAMES = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic',
                 'monaco','hanoi'];
  const out = [];
  for (let i = 0; i < NAMES.length; i += 4) {
    await page.reload();
    await page.waitForTimeout(4500);
    const part = await page.evaluate(async (batch) => {
      const g = window.__capy;
      // AND THE WAIT HAS TO BE INSIDE THE PAGE'S OWN CLOCK. The save restores
      // the last chapter visited, on a timer, WELL after window.__capy exists —
      // so a switchTo issued four and a half seconds in is quietly undone a
      // moment later and the whole soak runs in the wrong chapter under the
      // right chapter's name. Three more seconds of real time, and then ask.
      await new Promise((r) => setTimeout(r, 3200));
      // ...AND THE RESTORE FIRES FROM INSIDE tick(), NOT FROM A TIMER, which is
      // why waiting in real time did not help. Four rows of the first run came
      // back labelled with the previous batch's LAST chapter: the switch landed,
      // the soak started, and a few hundred ticks in the save quietly put the
      // game back where it had been left. Three hundred ticks of nothing first,
      // so the restore has already happened before anything is asked for.
      for (let w = 0; w < 300; w++) g.tick(1 / 60, false);
      const res = [];
      for (const name of batch) {
        // THE FIRST switchTo AFTER A RELOAD IS A NO-OP, and it cost a whole run
        // before it was caught. The page restores the saved chapter on load, and
        // a switchTo issued while that restore is still settling is dropped — so
        // the first row of every batch came back labelled with the LAST chapter
        // of the previous batch. Ask, tick, and ask again.
        g.biome.switchTo(name);
        for (let w = 0; w < 12; w++) g.tick(1 / 60, false);
        if (g.biome.current !== name) {
          g.biome.switchTo(name);
          for (let w = 0; w < 12; w++) g.tick(1 / 60, false);
        }
        const sp = g.biome.spawnOf(name), b = g.capy.body;
        b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position);
        const entered = g.biome.current;
        const keys = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft'];
        let nan = 0;
        // 3600 ticks is sixty seconds, and every twentieth of them RENDERS —
        // this touches the material every mesh in the game uses, so a shader
        // that fails to compile has to be given the chance to do it.
        for (let f = 0; f < 3600; f++) {
          if (f % 13 === 0) {
            const k = keys[(f * 7 + name.length) % keys.length];
            window.dispatchEvent(new KeyboardEvent(f % 26 === 0 ? 'keydown' : 'keyup', { code: k, bubbles: true }));
          }
          g.tick(1 / 60, f % 20 === 0);
          const p = g.capy.body.position;
          if (!(p.x === p.x && p.y === p.y && p.z === p.z)) { nan++; break; }
        }
        for (const k of keys) window.dispatchEvent(new KeyboardEvent('keyup', { code: k, bubbles: true }));
        res.push({ name, entered, biome: g.biome.current, nan,
                   err: g.state.lastError ? String(g.state.lastError) : null });
      }
      return res;
    }, NAMES.slice(i, i + 4));
    for (const r of part) out.push(r);
  }
  await page.evaluate((o) => fetch('/shot?name=pol-soak.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out);
}
