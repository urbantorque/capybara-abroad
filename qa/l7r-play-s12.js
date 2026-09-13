async page => {
  const dist = async () => page.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /^\d+(\.\d+)? m$/.test(e.textContent.trim()))
    const r = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0)
    return els.length ? parseFloat(els[0].textContent) : null
  })
  const dump = async (name, extra) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g && g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-30), err: g.state.lastError }
    })
    out.extra = extra
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  const log = []
  // walk like a player: pick the direction that shrinks the hat distance
  for (let i = 0; i < 4; i++) {
    let best = null
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      const d0 = await dist()
      await page.keyboard.down(k); await page.waitForTimeout(450); await page.keyboard.up(k)
      await page.waitForTimeout(150)
      const d1 = await dist()
      log.push([k, d0, d1])
      if (d0 != null && d1 != null && d1 < d0 - 0.5) { best = k; break }
    }
    if (best) { await page.keyboard.down(best); await page.waitForTimeout(1200); await page.keyboard.up(best) }
    await page.waitForTimeout(200)
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(500)
    const d = await dist()
    log.push(['E', d])
    if (d == null || d < 2) break
  }
  await page.screenshot({ path: 'qa/l7r-play-22.png' })
  await dump('l7r-play-s12.json', log)
}
