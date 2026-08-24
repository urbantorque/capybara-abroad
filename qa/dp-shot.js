async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200)
  await page.keyboard.up('KeyW')
  await page.waitForTimeout(1200)

  const a = await page.evaluate(() => {
    const g = window.__capy
    g.renderer.setSize(1280, 760, false)
    g.tick(1 / 60, true)
    return document.querySelector('canvas').toDataURL('image/png')
  })
  await page.evaluate(async d => { await fetch('/shot?name=dp-sydney', { method: 'POST', body: d }) }, a)

  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const s = g.biome.spawnOf('manly'), b = g.capy.body
    b.position.set(s.x, s.y, s.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    await new Promise(r => setTimeout(r, 2500))
  })

  const m = await page.evaluate(() => {
    const g = window.__capy
    for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
    g.renderer.setSize(1280, 760, false)
    g.tick(1 / 60, true)
    return document.querySelector('canvas').toDataURL('image/png')
  })
  await page.evaluate(async d => { await fetch('/shot?name=dp-manly', { method: 'POST', body: d }) }, m)
}
