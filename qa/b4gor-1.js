async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0,180)))
  await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    await new Promise(r => setTimeout(r, 1200))
  })
  await page.keyboard.down('e')
  const out = { errs, log: [] }
  for (let chunk = 0; chunk < 14; chunk++) {
    const r = await page.evaluate(() => {
      const g = window.__capy, A = g.goreme
      const rec = []
      for (let i = 0; i < 900; i++) {
        const b = A.balloon()
        const c = g.capy.position
        // keep the animal in the basket until it is airborne enough to be carried
        if (A.altitude() < 1.2) {
          if (g.capy.body) { g.capy.body.position.x = b.x; g.capy.body.position.z = b.z; g.capy.body.position.y = b.y + 0.55 }
        }
        g.tick(1/60, i % 60 === 0)
        const done = g.taskDone('sunrise')
        if (done) {
          g.tick(1/60, true)
          const cam = g.camera.position, cp = g.capy.position
          const dx = cam.x - cp.x, dy = cam.y - cp.y, dz = cam.z - cp.z
          const d = Math.hypot(dx, dy, dz)
          rec.push({ HIT: 1, i,
            camYaw: Math.atan2(dx, dz), camPitch: Math.asin(dy / d), dist: d,
            raise: dy, capy: [cp.x|0, cp.y|0, cp.z|0],
            sunBear: Math.atan2(760 - cp.x, -70 - cp.z),
            framing: g.framing(), alt: A.altitude(), sunUp: A.sunUp(),
            aboard: A.aboard() })
          break
        }
      }
      const A2 = g.goreme
      rec.push({ HIT: 0, sunUp: A2.sunUp(), alt: A2.altitude(), aboard: A2.aboard(),
                 capyY: g.capy.position.y, balY: A2.balloon().y, burn: A2.burner() })
      return rec
    })
    out.log.push(r)
    if (r.some(x => x.HIT === 1)) break
  }
  await page.keyboard.up('e')
  await page.evaluate(async o => { await fetch('/shot?name=b4gor-1.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
