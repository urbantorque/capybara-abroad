async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const info = {}
  for (const n of ['venice', 'manly']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(2500)
    const buf = await page.screenshot({ clip: { x: 1040, y: 480, width: 240, height: 240 } })
    await page.evaluate(async (a) => { await fetch('/shot?name=mapx-' + a.n, { method: 'POST', body: 'data:image/png;base64,' + a.d }) }, { d: buf.toString('base64'), n })
    info[n] = await page.evaluate(() => {
      const m = document.querySelector('.capyui-map')
      const r = m.getBoundingClientRect()
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), show: m.classList.contains('show'),
        dist: (document.querySelector('.capyui-mapdist') || {}).className }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=mapinfo.json', { method: 'POST', body: btoa(JSON.stringify(o)) }) }, info)
}
