async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go:not(.alt)') || document.querySelector('.capyui-carry'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  const out = []
  for (const [name, x, z] of [['sydney', -9.4, 17.5], ['venice', -3.2, 15], ['kowloon', -6.2, 9.3]]) {
    await page.evaluate(async ({ name, x, z }) => {
      const g = window.__capy
      if (g.biome.current !== name) { g.hud.cross(name); await new Promise(r => setTimeout(r, 8000)) }
      const cb = g.capy.body
      const api = name === 'sydney' ? g.env : g[name]
      const gy = api && api.terrainHeight ? api.terrainHeight(x, z) : 0
      cb.wakeUp(); cb.position.set(x, gy + 0.6, z); cb.velocity.set(0, 0, 0); cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
    }, { name, x, z })
    const samples = []
    for (let c = 0; c < 4; c++) {
      const s = await page.evaluate(async () => {
        const g = window.__capy
        await new Promise(r => setTimeout(r, 15000))
        const T = g.THREE
        const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd)
        const p = g.capy.position, c = g.camera.position
        const d = Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z)
        return { t: +g.state.time.toFixed(0), camY: +c.y.toFixed(2), capyY: +p.y.toFixed(2), dist: +d.toFixed(2), pitchDeg: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1), above: +(c.y - p.y).toFixed(2), rest: g.capy.rest !== undefined ? +(+g.capy.rest).toFixed(2) : null, loaf: +(+g.capy.loaf).toFixed(2), nap: g.capy.nap !== undefined ? +(+g.capy.nap).toFixed(2) : null }
      })
      samples.push(s)
    }
    await page.screenshot({ path: 'qa/l7r-qa-idle-' + name + '.png' })
    // then C, then W for 3 s
    await page.keyboard.press('KeyC'); await page.waitForTimeout(2500)
    const afterC = await page.evaluate(() => { const g = window.__capy; const T = g.THREE; const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd); const p = g.capy.position, c = g.camera.position; return { camY: +c.y.toFixed(2), dist: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2), pitchDeg: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1) } })
    await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
    const afterW = await page.evaluate(() => { const g = window.__capy; const T = g.THREE; const fwd = new T.Vector3(); g.camera.getWorldDirection(fwd); const p = g.capy.position, c = g.camera.position; return { camY: +c.y.toFixed(2), dist: +Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z).toFixed(2), pitchDeg: +(Math.asin(-fwd.y) * 180 / Math.PI).toFixed(1) } })
    out.push({ name, at: [x, z], samples, afterC, afterW })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-idle.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { out })
}
