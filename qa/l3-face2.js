async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(7000)
  await page.evaluate(() => { const g = window.__capy; const live = g.biome.current; const r = g.locals.find(x => x.biome === live && x.fig && x.authority); const b = g.capy.body
    const x = r.x + Math.sin(r.face) * 2.2, z = r.z + Math.cos(r.face) * 2.2; b.position.set(x, r.y + 0.6, z); b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position); r.gest = 4; r.mood = 0.8 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'qa/l3-face2.png' })
  const r = await page.evaluate(() => ({ err: window.__capy.state.lastError || null }))
  await page.evaluate((o) => fetch('/shot?name=l3-face2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), r)
}
