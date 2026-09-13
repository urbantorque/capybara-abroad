async page => {
  const TAG = 'l7r-design-why'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => {
    window.__ev = []
    const w = document.querySelector('.capyui-toasts')
    if (w) new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.textContent) window.__ev.push([performance.now(), n.textContent.slice(0, 90)]) }).observe(w, { childList: true })
    document.querySelector('.capyui-go').click()
  })
  await page.waitForTimeout(7000)
  const biomes = await page.evaluate(async () => { const m = await import('/src/shared.js'); return m.CHAPTERS.map(c => c.biome) })
  const out = { chapters: [] }
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  for (const b of biomes) {
    if (b !== 'sydney') { await page.evaluate(b => window.__capy.hud.cross(b), b); await page.waitForTimeout(9000) }
    // stand 3 m short of the marquee's hint target, at ground level
    const put = await page.evaluate(async b => {
      const g = window.__capy
      const m = await import('/src/shared.js')
      const ch = m.CHAPTERS.find(c => c.biome === b)
      const wowRow = m.TASKS.find(t => t.chapter === ch.n && t.wow)
      let h = null
      try { h = g.hintTarget(wowRow.id) } catch (e) {}
      if (!h) { const mq = ch.marquee; h = { x: mq.x, y: (mq.up || 0), z: mq.z } }
      const p = g.capy.position
      const dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz) || 1
      const tx = h.x - dx / d * 3, tz = h.z - dz / d * 3
      let ty = h.y
      try { if (typeof g.groundY === 'function') ty = g.groundY(tx, tz) } catch (e) {}
      const body = g.capy.body
      if (body) { body.position.set(tx, ty + 0.6, tz); body.velocity.set(0, 0, 0) } else { g.capy.position.set(tx, ty + 0.6, tz) }
      window.__ev.length = 0
      return { id: wowRow.id, at: [+tx.toFixed(1), +(ty + 0.6).toFixed(1), +tz.toFixed(1)] }
    }, b)
    await page.waitForTimeout(2500)
    const n0 = await page.evaluate(() => { window.__ev.length = 0; return 0 })
    await tap('KeyQ', 110); await page.waitForTimeout(3000)
    const afterQ = await page.evaluate(() => window.__ev.map(e => e[1]))
    await page.evaluate(() => { window.__ev.length = 0 })
    await tap('KeyE', 160); await page.waitForTimeout(3000)
    const afterE = await page.evaluate(() => window.__ev.map(e => e[1]))
    const st = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; return { pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], err: g.state.lastError || null, done: g.taskDone ? null : null } })
    out.chapters.push({ biome: b, id: put.id, at: put.at, pos: st.pos, q: afterQ, e: afterE, err: st.err })
    await page.screenshot({ path: 'qa/' + TAG + '-' + b + '.png' })
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
