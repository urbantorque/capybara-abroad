async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const b of names) {
    await page.evaluate((n) => {
      const g = window.__capy
      g.biome.switchTo(n)
      g.state.lastError = null
      const S = g.biome.spawnOf(n)
      const bd = g.capy.body
      bd.position.set(S.x, S.y, S.z); bd.velocity.set(0,0,0)
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
    }, b)
    await page.waitForTimeout(2200)
    out[b] = await page.evaluate(() => {
      const g = window.__capy
      const p = g.capy.position
      return { err: g.state.lastError || null,
               ok: isFinite(p.x) && isFinite(p.y) && isFinite(p.z),
               locals: g.locals.filter(l => l.biome === g.biome.current).length,
               bodies: g.world.bodies.length }
    })
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=p4all.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
