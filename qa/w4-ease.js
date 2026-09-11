async page => {
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const out = {}
  const tp = (name, x, y, z) => page.evaluate(([name, x, y, z]) => {
    const g = window.__capy; if (g.biome.current !== name) g.biome.switchTo(name)
    const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [name, x, y, z])
  // HK: on the roof with the show off; the phase should hurry and the show start
  await page.evaluate(() => window.__capy.biome.switchTo('kowloon')); await page.waitForTimeout(2500)
  const roof = await page.evaluate(() => { const r = window.__capy.kowloon.roof; return { x: r.x, y: r.y, z: r.z } })
  await tp('kowloon', roof.x, roof.y + 0.5, roof.z)
  const hk = []
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    hk.push(await page.evaluate(() => { const g = window.__capy; const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }; return { t: +g.state.time.toFixed(0), showing: g.kowloon.showing(), live: q('.capyui-marqlive'), done: g.taskDone('symphony') } }))
    if (hk[hk.length - 1].done) break
  }
  out.hk = hk.filter((r, i) => i % 4 === 0 || r.done || r.showing)
  // Cali: a strike while on the roof of the parked bus
  await page.evaluate(() => window.__capy.biome.switchTo('cali')); await page.waitForTimeout(2500)
  const ch = await page.evaluate(() => { const c = window.__capy.cali.chivaAt(); return { x: c.x, y: c.y, z: c.z } })
  await tp('cali', ch.x, ch.y + 4.2, ch.z)
  await page.waitForTimeout(1500)
  out.caliBefore = await page.evaluate(() => ({ on: window.__capy.cali.onChiva(), st: window.__capy.cali.chivaState() }))
  await page.evaluate(() => window.__capy.cali.wireDebug())
  await page.waitForTimeout(1800)
  out.caliAfter = await page.evaluate(() => { const g = window.__capy; const p = g.capy.position; const c = g.cali.chivaAt(); return { on: g.cali.onChiva(), dy: +(p.y - c.y).toFixed(2), dx: +Math.hypot(p.x - c.x, p.z - c.z).toFixed(2), toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent).slice(-2) } })
  // Venice: in the square at low water; the phase should run at 5x
  await page.evaluate(() => window.__capy.biome.switchTo('venice')); await page.waitForTimeout(2500)
  await tp('venice', 0, 0.6, -34)
  await page.evaluate(() => window.__capy.venice.phaseDebug(0.10))
  await page.waitForTimeout(500)
  const v0 = await page.evaluate(() => window.__capy.venice.phaseDebug())
  await page.waitForTimeout(4000)
  const v1 = await page.evaluate(() => window.__capy.venice.phaseDebug())
  out.venRate = +((v1 - v0) * 205 / 4).toFixed(2)
  // Hanoi: in the alley; the countdown should run at 3x
  await page.evaluate(() => window.__capy.biome.switchTo('hanoi')); await page.waitForTimeout(2500)
  await tp('hanoi', -82, 0.6, 48.5)
  await page.waitForTimeout(800)
  const h0 = await page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent)
  await page.waitForTimeout(5000)
  const h1 = await page.evaluate(() => (document.querySelector('.capyui-marqlive') || {}).textContent)
  out.hanoi = [h0, h1]
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w4ease.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
