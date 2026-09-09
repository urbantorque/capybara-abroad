async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  for (const n of ['palawan','goreme']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    }, n)
    // real clock, real rAF, audio unlocked: drive with real keys for 45 s
    for (let i = 0; i < 9; i++) {
      await page.keyboard.down('KeyW'); await page.waitForTimeout(1200)
      await page.keyboard.up('KeyW')
      await page.keyboard.down('KeyA'); await page.waitForTimeout(600)
      await page.keyboard.up('KeyA')
      await page.keyboard.press('Space')
      await page.keyboard.press('KeyQ')
      await page.keyboard.down('KeyE'); await page.waitForTimeout(1800)
      await page.keyboard.up('KeyE')
      await page.waitForTimeout(1400)
    }
  }
  const out = await page.evaluate(() => {
    const g = window.__capy
    return { err: g.state.lastError || null, biome: g.biome.current,
             started: g.state.started, time: Math.round(g.state.time || 0),
             pos: [Math.round(g.capy.body.position.x), Math.round(g.capy.body.position.y), Math.round(g.capy.body.position.z)] }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=zasoak.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
