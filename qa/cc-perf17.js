async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  // THE LIST IS DERIVED, NEVER SPELLED. This file carried a hard-coded
  // seventeen and was therefore blind to Monte Carlo and Hanoi — the two
  // LARGEST chapters in the game and the two qa/BUDGET.md flags as over the
  // triangle gate. It is the same hole the closeout found in channels.mjs,
  // budget.js, stillness.js and fuzz.js and closed in four of the five; this
  // was the fifth, and it went on printing a confident seventeen-row table.
  // The file keeps its name because every script and every note refers to it.
  const shared = await (await page.request.get('http://localhost:5188/src/shared.js')).text()
  const names = [...shared.matchAll(/\{\s*n:\s*(\d+),\s*biome:\s*'([a-z]+)'/g)].map(m => m[2])
  const out = { _chapters: names.length }
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      await sleep(2600)
      const ts = []; let last = performance.now(); const t0 = last
      while (performance.now() - t0 < 5000) {
        await new Promise(r => requestAnimationFrame(r))
        const now = performance.now(); ts.push(now - last); last = now
      }
      ts.sort((a,c)=>a-c)
      // cast NPCs that belong to this chapter
      let cast = 0
      for (const p of (g.npcs || [])) {
        if (!p) continue
        const bi = p.biome || (p.body && p.body.userData && p.body.userData.biome) || null
        if (bi === undefined || bi === null) { if (name === 'sydney') cast++ } else if (bi === name) cast++
      }
      return { median: +ts[(ts.length*0.5)|0].toFixed(2), p95: +ts[(ts.length*0.95)|0].toFixed(2),
               max: +ts[ts.length-1].toFixed(2), frames: ts.length, cast,
               err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=perf17.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
