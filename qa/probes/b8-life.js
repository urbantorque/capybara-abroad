async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text()
    const i = src.indexOf('export const CHAPTERS = [')
    const j = src.indexOf('\n];', i)
    const keys = []
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1])
    if (keys.length < 2) throw new Error('chapter parse failed')
    return keys
  })
  const out = { chapters: NAMES.length, seen: {} }
  for (const n of NAMES) {
    out.seen[n] = await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false
      for (let i = 0; i < 60 * 6; i++) g.tick(1 / 60, false)
      const a = g.hud && g.hud.calmAudit ? g.hud.calmAudit() : null
      if (!a) return 'no calmAudit'
      const mine = a.critters.filter(c => c.biome === name)
      return { biome: g.biome.current, n: mine.length,
               rows: mine.map(c => ({ r: +c.r.toFixed(1), near: +c.near.toFixed(2), bold: c.bold })) }
    }, n)
  }
  // ---- row 6: does the snowcat actually wait for a glacier run? ----------
  out.iceland = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('iceland')
    for (let i = 0; i < 180; i++) g.tick(1 / 60, false)
    const b = g.capy.body
    const ice = g.iceland
    const snow = () => { const s = ice.snowcat(); return { x: +s.x.toFixed(1), z: +s.z.toFixed(1) } }
    // park the animal at the glacier runout, where every run ends
    const y = ice.terrainHeight(-20, -86)
    b.position.set(-20, y + 0.5, -86); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    // run it long enough that the machine must reach the bottom at least once
    let atBottomFor = 0, best = 0, prev = null
    for (let i = 0; i < 60 * 70; i++) {
      b.position.set(-20, y + 0.5, -86); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.tick(1 / 60, false)
      const s = ice.snowcat()
      if (Math.abs(s.z - (-86)) < 1.5) { atBottomFor += 1 / 60; if (atBottomFor > best) best = atBottomFor }
      else atBottomFor = 0
      prev = s
    }
    return { snowcatX: +ice.snowcat().x.toFixed(1), heldAtBottomSecs: +best.toFixed(1),
             walkFromRunout: +Math.hypot(-20 - 34, 0).toFixed(1) }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-life.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
