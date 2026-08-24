async page => {
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload(); await page.waitForTimeout(6500);
  await page.mouse.click(500, 400);
  await page.waitForTimeout(2500);
  const out = await page.evaluate(async () => {
    const g = window.__capy;
        const locals = g.locals || null;
    const res = { found: !!locals, bad: [], counts: {} };
    if (!locals) return res;
    // resolve a pool the same way npc.js does, but surfacing throws
    const resolve = (arr) => {
      let src = arr, threw = null;
      if (typeof src === 'function') { try { src = src(); } catch (e) { return { n:0, threw:String(e) }; } }
      if (!src || !src.length) return { n: 0, threw: null };
      let n = 0;
      for (const e of src) {
        if (typeof e === 'string') { n++; continue; }
        if (!e || !e.t) continue;
        if (e.after && !g.taskDone(e.after)) continue;
        if (e.before && g.taskDone(e.before)) continue;
        if (e.when) { let ok=false; try { ok = !!e.when(); } catch (err) { threw = String(err); continue; } if (!ok) continue; }
        n++;
      }
      return { n, threw };
    };
    for (const bn of ['venice','kowloon','palawan']) {
      g.biome.switchTo(bn);
      for (let i=0;i<120;i++) g.tick(1/60,false);
      const mine = locals.filter(l => l.biome === bn);
      res.counts[bn] = mine.length;
      // sample the whole world clock: several points across a full cycle
      for (let s = 0; s < 10; s++) {
        for (let i=0;i<60*26;i++) g.tick(1/60,false);
        for (let k = 0; k < mine.length; k++) {
          const L = mine[k];
          const a = resolve(L.lines), b = resolve(L.wheekLines);
          if (a.threw || b.threw) res.bad.push([bn, k, 'THREW', a.threw||b.threw]);
          if (a.n === 0) res.bad.push([bn, k, 'no-lines', s]);
          if (L.wheekLines && b.n === 0) res.bad.push([bn, k, 'no-wheek', s]);
        }
      }
    }
    res.lastError = g.state.lastError || null;
    return res;
  });
  await page.evaluate(async (o) => {
    await fetch('/shot?name=wg.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) });
  }, out);
}
