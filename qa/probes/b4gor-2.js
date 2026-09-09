async page => {
  const out = { log: [] }
  await page.keyboard.down('e')
  for (let c = 0; c < 10; c++) {
    const r = await page.evaluate(() => {
      const g = window.__capy, A = g.goreme
      for (let i = 0; i < 300; i++) g.tick(1/60, i % 30 === 0)
      const cp = g.capy.position
      return { sunUp: A.sunUp(), alt: A.altitude(), aboard: A.aboard(),
               capy: [Math.round(cp.x), Math.round(cp.y), Math.round(cp.z)] }
    })
    out.log.push(r)
    if (r.sunUp > 0.48) break
  }
  await page.keyboard.up('e')
  await page.evaluate(() => {
    const g = window.__capy
    g.frameShot({ yaw: 4.712, hold: 40 })
    for (let i = 0; i < 90; i++) g.tick(1/60, true)
  })
  const fin = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    const cam = g.camera.position, cp = g.capy.position
    const dx = cam.x-cp.x, dy = cam.y-cp.y, dz = cam.z-cp.z, d = Math.hypot(dx,dy,dz)
    return { framing: g.framing(), camYaw: Math.atan2(dx,dz), camPitch: Math.asin(dy/d),
             dist: d, sunUp: A.sunUp(), alt: A.altitude() }
  })
  out.fin = fin
  await page.evaluate(async o => { await fetch('/shot?name=b4gor-2.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
