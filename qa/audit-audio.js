async page => {
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave']
  const out = { perBiome: {} }
  await page.evaluate(() => {
    const g = window.__capy
    if (!g.__sfxHooked) {
      g.__sfxHooked = true
      g.__tally = {}
      const raw = g.sfx.bind(g)
      g.sfx = function (n, o) {
        const t = g.__tally
        if (!t[n]) t[n] = { n: 0, stacks: [] }
        t[n].n++
        if (t[n].stacks.length < 3) {
          const s = (new Error().stack || '').split('\n').slice(2, 6).join(' | ')
          if (t[n].stacks.indexOf(s) < 0) t[n].stacks.push(s)
        }
        return raw(n, o)
      }
    }
  })
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      g.__tally = {}
      g.state.lastError = null
    }, n)
    await page.waitForTimeout(14000)
    out.perBiome[n] = await page.evaluate(() => {
      const g = window.__capy
      return { tally: g.__tally, lastError: g.state.lastError || null }
    })
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=auditaudio.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
