async page => {
  const BIOMES = ['sydney', 'kyoto', 'venice', 'monaco']
  const TAG = 'l6r-design-stand'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  const out = { rows: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  for (const b of BIOMES) {
    if (b !== 'sydney') { await page.evaluate(x => window.__capy.hud.cross(x), b); await page.waitForTimeout(9000) }
    const rows = await page.evaluate(async b => { const m = await import('/src/shared.js'); const ch = m.CHAPTERS.find(c => c.biome === b); return m.TASKS.filter(t => t.chapter === ch.n).map(t => ({ id: t.id, wow: !!t.wow, mini: !!t.mini })) }, b)
    for (const r of rows) {
      const s0 = await page.evaluate(async r => {
        const g = window.__capy
        if (g.biome.current !== r.b) return { skip: 'biome ' + g.biome.current }
        if (g.taskDone(r.id)) return { skip: 'already' }
        const h = g.hintTarget(r.id)
        if (!h) return { skip: 'no-target' }
        g.capy.body.position.set(h.x, h.y + 0.6, h.z); g.capy.body.velocity.set(0, 0, 0)
        return { ok: true, h: [+h.x.toFixed(1), +h.y.toFixed(1), +h.z.toFixed(1)] }
      }, { id: r.id, b })
      if (!s0.ok) { out.rows.push([b, r.id, s0.skip]); continue }
      await page.waitForTimeout(4500)
      const t1 = await page.evaluate(id => window.__capy.taskDone(id), r.id)
      let how = t1 ? 'stand' : null
      if (!how) { await tap('KeyE', 160); await page.waitForTimeout(1800); const t2 = await page.evaluate(id => window.__capy.taskDone(id), r.id); if (t2) how = 'E' }
      if (!how) { await tap('KeyQ', 120); await page.waitForTimeout(1500); const t3 = await page.evaluate(id => window.__capy.taskDone(id), r.id); if (t3) how = 'Q' }
      out.rows.push([b, r.id, how || 'more', r.wow ? 'wow' : r.mini ? 'mini' : '', s0.h])
      const err = await page.evaluate(() => window.__capy.state.lastError || null)
      if (err) { out.rows.push([b, r.id, 'ERR', err]); }
    }
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
