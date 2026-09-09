async page => {
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3000)
  await page.evaluate(() => {
    const g = window.__capy
    g.__tally = {}
    const raw = g.sfx.bind(g)
    g.sfx = function (n, o) { const t = g.__tally; t[n] = (t[n] || 0) + 1; return raw(n, o) }
  })
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave']
  const out = { play: {}, paused: {} }
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.__tally = {}
    }, n)
    await page.waitForTimeout(11000)
    out.play[n] = await page.evaluate(() => { const t = window.__capy.__tally; window.__capy.__tally = {}; return t })
    await page.evaluate(() => { window.__capy.state.paused = true })
    await page.waitForTimeout(11000)
    out.paused[n] = await page.evaluate(() => { const t = window.__capy.__tally; window.__capy.__tally = {}; return t })
    await page.evaluate(() => { window.__capy.state.paused = false })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=auditaudio2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
