async page => {
  await page.setViewportSize({ width: 1400, height: 800 })
  const out = { log: [] }
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  await page.evaluate(() => window.__capy.biome.switchTo('venice')); await page.waitForTimeout(3000)
  await page.evaluate(() => { const g = window.__capy; g.venice.phaseDebug(0.40)
    const b = g.capy.body; b.position.set(0, 0.6, -34); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) })
  const card = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const g = window.__capy; const p = g.capy.position
    return { t: +g.state.time.toFixed(1), tide: +g.venice.tide().toFixed(2), head: q('.capyui-marqhead'), live: q('.capyui-marqlive'),
             done: g.taskDone('acqua-alta'), x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2),
             toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent), err: g.state.lastError || null }
  })
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000)
    const c = await card(); out.log.push(c)
    if (c.done && !out.shot) { out.shot = true; await page.waitForTimeout(500); await page.screenshot({ path: 'qa/w1-venice-top.png' }) }
    if (c.done && i > 34) break
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w1venice.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
