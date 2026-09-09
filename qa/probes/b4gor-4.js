async page => {
  const o = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    g.frameShot({ yaw: 4.712, pitch: 0.02, raise: 1.2, hold: 60 })
    for (let i = 0; i < 120; i++) g.tick(1/60, true)
    const cam = g.camera.position, cp = g.capy.position
    const dx=cam.x-cp.x, dy=cam.y-cp.y, dz=cam.z-cp.z, d=Math.hypot(dx,dy,dz)
    return { framing: g.framing(), camPitch: Math.asin(dy/d), camYaw: Math.atan2(dx,dz),
             sunUp: A.sunUp(), alt: A.altitude(),
             sunElev: Math.atan2(300 - cam.y, Math.hypot(760-cam.x, -70-cam.z)) }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-4.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, o)
}
