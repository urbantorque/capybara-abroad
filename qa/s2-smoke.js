async page => {
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()) })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const out = { errs }
  for (const n of ['quay','kyoto','cali']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(3000)
    out[n] = await page.evaluate(() => ({
      bodies: window.__capy.world.bodies.length,
      err: window.__capy.state.lastError || null,
      t: window.__capy.state.time,
    }))
  }
  out.errs2 = errs.slice(0, 12)
  await page.evaluate((o) => fetch('/shot?name=s2smoke.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
