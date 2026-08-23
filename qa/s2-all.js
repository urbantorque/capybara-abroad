async page => {
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()) })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.state.lastError = null
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(2500)
    out[n] = await page.evaluate(() => ({
      bodies: window.__capy.world.bodies.length,
      err: window.__capy.state.lastError || null,
    }))
  }
  out.errs = errs.slice(0, 15)
  await page.evaluate((o) => fetch('/shot?name=s2all.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
