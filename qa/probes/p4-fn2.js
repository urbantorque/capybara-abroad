async page => {
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2500)
  const out = {}
  await page.evaluate(() => { window.__capy.biome.switchTo('cali') })
  await page.waitForTimeout(1200)
  out.before = await page.evaluate(() => { const c = window.__capy.cali.cart(); return [+c.x.toFixed(1), +c.y.toFixed(1)] })
  await page.evaluate(() => {
    const g = window.__capy, c = g.cali.cart(), bd = g.capy.body
    bd.position.set(c.x + 2.0, c.y + 1.0, c.z + 2.0); bd.velocity.set(0,0,0)
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
  })
  await page.waitForTimeout(600)
  await page.keyboard.down('KeyE'); await page.waitForTimeout(160); await page.keyboard.up('KeyE')
  await page.evaluate(() => {
    const g = window.__capy, bd = g.capy.body
    bd.position.set(-20, 2, 0); bd.velocity.set(0,0,0)
    bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
  })
  const trail = []
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(4000)
    trail.push(await page.evaluate(() => {
      const g = window.__capy, c = g.cali.cart()
      return [+c.x.toFixed(0), +c.y.toFixed(0), g.cali.cartRolling() ? 'R' : '.', +g.cali.cartSpeed().toFixed(1)]
    }))
  }
  out.trail = trail
  await page.evaluate(async (o) => { await fetch('/shot?name=p4fn2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
