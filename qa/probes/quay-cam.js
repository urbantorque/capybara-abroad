async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('quay') })
  await page.waitForTimeout(2000)
  await page.evaluate(() => {
    const g = window.__capy, q = g.quay
    const h = q.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1400)
  await page.keyboard.press('e')
  await page.waitForTimeout(400)
  await page.keyboard.down('w')
  await page.waitForTimeout(9000)
  await page.keyboard.up('w')
  const o = await page.evaluate(() => {
    const g = window.__capy, q = g.quay, c = g.camera
    const yaw = q.boat.heading
    const dx = c.position.x - q.boat.position.x, dz = c.position.z - q.boat.position.z
    const along = dx * Math.sin(yaw) + dz * Math.cos(yaw)   // + = toward the bow
    return { boatYaw: +yaw.toFixed(2), camYaw: +g.input.camYaw.toFixed(2),
             alongHull: +along.toFixed(1), sp: +q.boat.speed.toFixed(1),
             atHelm: q.boat.atHelm, sailing: g.state.sailing }
  })
  await page.evaluate(async (r) => { await fetch('/shot?name=quaycam.json', { method: 'POST', body: btoa(JSON.stringify(r)) }) }, o)
}
