async page => {
  const out = { log: [] }
  await page.keyboard.down('e')
  for (let c = 0; c < 20; c++) {
    const r = await page.evaluate(() => {
      const g = window.__capy, A = g.goreme
      for (let i = 0; i < 400; i++) g.tick(1/60, i % 40 === 0)
      return { sunUp: A.sunUp(), alt: A.altitude() }
    })
    out.log.push(r)
    if (r.sunUp > 0.44) break
  }
  await page.keyboard.up('e')
  await page.evaluate(() => {
    const g = window.__capy
    g.frameShot({ yaw: 4.712, pitch: 0.16, hold: 60 })
    for (let i = 0; i < 120; i++) g.tick(1/60, true)
  })
  out.fin = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    const cam = g.camera.position, cp = g.capy.position
    const dx=cam.x-cp.x, dy=cam.y-cp.y, dz=cam.z-cp.z, d=Math.hypot(dx,dy,dz)
    return { framing: g.framing(), camYaw: Math.atan2(dx,dz), camPitch: Math.asin(dy/d), dist: d,
             sunUp: A.sunUp(), alt: A.altitude(), capy: [cp.x, cp.y, cp.z] }
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4gor-3.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
