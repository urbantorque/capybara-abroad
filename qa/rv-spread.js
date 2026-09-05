async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(3000);
  const out = await page.evaluate(async function () {
    const g = window.__capy;
    const S = await import('/src/shared.js');
    const rows = [];
    for (const ch of S.CHAPTERS) {
      g.biome.switchTo(ch.biome);
      const sp = g.biome.spawnOf(ch.biome) || { x: 0, y: 0, z: 0 };
      const b = g.capy.body; b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0);
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false);
      const tasks = S.TASKS.filter(t => t.chapter === ch.n);
      const ds = [], none = [];
      let wow = null;
      for (const t of tasks) {
        const p = g.hintTarget(t.id);
        if (!p) { none.push(t.id); continue; }
        const d = Math.hypot(p.x - sp.x, p.z - sp.z);
        ds.push({ id: t.id, d: +d.toFixed(0), wow: !!t.wow, mini: !!t.mini });
        if (t.wow) wow = +d.toFixed(0);
      }
      ds.sort((a, b) => a.d - b.d);
      const arr = ds.map(x => x.d);
      const med = arr.length ? arr[arr.length >> 1] : -1;
      rows.push({ n: ch.n, biome: ch.biome, far: ch.far, tasks: tasks.length,
                  pointed: ds.length, noPointer: none,
                  nearest: ds.slice(0, 3).map(x => x.id + ':' + x.d),
                  within20: arr.filter(d => d <= 20).length,
                  within50: arr.filter(d => d <= 50).length,
                  median: med, max: arr.length ? arr[arr.length - 1] : -1,
                  farthest: ds.slice(-2).map(x => x.id + ':' + x.d),
                  marquee: wow,
                  finds: S.FINDS.filter(f => f.biome === ch.biome || f.chapter === ch.n).length,
                  records: tasks.filter(t => S.RECORDS[t.id]).length,
                  acts: ch.acts ? ch.acts.length : 0 });
    }
    return { rows };
  });
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=rv-spread.json', { method: 'POST', body: s }), bl);
}
