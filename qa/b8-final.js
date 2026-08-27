async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const NAMES = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js', { cache: 'no-store' })).text()
    const i = src.indexOf('export const CHAPTERS = ['), j = src.indexOf('\n];', i)
    const keys = []
    for (const m of src.slice(i, j).matchAll(/\bbiome:\s*'([a-z]+)'/g)) keys.push(m[1])
    if (keys.length < 2) throw new Error('chapter parse failed')
    return keys
  })
  const out = { chapters: NAMES.length, rows: [] }
  for (const n of NAMES) {
    out.rows.push(await page.evaluate((name) => {
      const g = window.__capy
      g.state.lastError = null
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.input.x = 0; g.input.z = 0; g.input.action = false
      // twelve seconds of standing still: the find sweep runs 4x a second
      for (let i = 0; i < 60 * 12; i++) g.tick(1 / 60, false)
      return { n: g.biome.current, err: g.state.lastError || null,
               drift: +Math.hypot(b.position.x - sp.x, b.position.z - sp.z).toFixed(2) }
    }, n))
  }
  out.console = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (d) => {
    await fetch('/shot?name=b8-final.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(d, null, 1)))) })
  }, out)
}
