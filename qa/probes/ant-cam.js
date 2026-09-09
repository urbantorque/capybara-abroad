async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('antarctic') })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const h = a.boat.helm
    g.capy.body.position.set(h.x, h.y + 0.2, h.z)
    g.capy.body.velocity.set(0, 0, 0)
  })
  await page.waitForTimeout(1200)
  await page.keyboard.press('e')
  await page.waitForTimeout(400)
  await page.keyboard.down('w')
  await page.waitForTimeout(9000)
  await page.keyboard.up('w')
  const o = await page.evaluate(() => {
    const g = window.__capy, a = g.antarctic
    const c = g.camera
    const bx = a.boat.position.x, bz = a.boat.position.z
    const yaw = a.boat.heading
    // camera relative to the boat, in BOAT-LOCAL coordinates: +z is the bow
    const dx = c.position.x - bx, dz = c.position.z - bz
    const cs = Math.cos(-yaw), sn = Math.sin(-yaw)
    const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs
    return { boatYaw: +yaw.toFixed(2), camYaw: +g.input.camYaw.toFixed(2),
             camLocal: [+lx.toFixed(1), +(c.position.y).toFixed(1), +lz.toFixed(1)],
             sp: +a.boat.speed.toFixed(1),
             podY: (function(){ const q = a.pod(); return [+q.x.toFixed(0), +q.z.toFixed(0)] })() }
  })
  await page.evaluate(async (r) => { await fetch('/shot?name=antcam.json', { method: 'POST', body: btoa(JSON.stringify(r)) }) }, o)
}
