async page => {
  const TAG = 'l7r-design-marq'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(7000)
  const biomes = await page.evaluate(async () => { const m = await import('/src/shared.js'); return m.CHAPTERS.map(c => c.biome) })
  const out = { chapters: [] }
  for (const b of biomes) {
    if (b !== 'sydney') { await page.evaluate(b => window.__capy.hud.cross(b), b); await page.waitForTimeout(9000) }
    const rec = await page.evaluate(async b => {
      const g = window.__capy
      const m = await import('/src/shared.js')
      const ch = m.CHAPTERS.find(c => c.biome === b)
      const p = g.capy.position
      const V = Object.getPrototypeOf(g.camera.position).constructor
      const proj = (x, y, z) => { const v = new V(x, y, z); v.project(g.camera); return { on: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1, x: +v.x.toFixed(2), y: +v.y.toFixed(2) } }
      const mq = ch.marquee || {}
      const wowRow = m.TASKS.find(t => t.chapter === ch.n && t.wow)
      const mp = proj(mq.x || 0, (mq.up || 0) + 1, mq.z || 0)
      const dMarq = +Math.hypot((mq.x || 0) - p.x, (mq.z || 0) - p.z).toFixed(0)
      // the marquee's own hint target (may differ from the marquee point)
      let hm = null
      try { hm = wowRow ? g.hintTarget(wowRow.id) : null } catch (e) { hm = null }
      const dHint = hm ? +Math.hypot(hm.x - p.x, hm.z - p.z).toFixed(0) : null
      const rows = m.TASKS.filter(t => t.chapter === ch.n)
      const dist = []
      for (const r of rows) { let h = null; try { h = g.hintTarget(r.id) } catch (e) {} dist.push([r.id, h ? +Math.hypot(h.x - p.x, h.z - p.z).toFixed(0) : null, r.act || 1, !!r.wow, !!r.mini, r.needs || '']) }
      const act1 = dist.filter(d => d[2] === 1 && d[1] !== null).map(d => d[1]).sort((a, b) => a - b)
      const paper = ((document.querySelector('.capyui-todo') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 400)
      const nx = (() => { try { const api = g.biome && g.biome.api ? g.biome.api : null; return null } catch (e) { return null } })()
      return { n: ch.n, biome: b, live: g.biome.current, rows: rows.length, dMarq, dHint, marqOn: mp.on, marqXY: [mp.x, mp.y], up: mq.up || 0, say: mq.say,
        nearest3: act1.slice(0, 3), act1Median: act1[Math.floor(act1.length / 2)], farthest: act1[act1.length - 1], dist, paper, err: g.state.lastError || null }
    }, b)
    out.chapters.push(rec)
    await page.screenshot({ path: 'qa/' + TAG + '-' + b + '.png' })
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
