async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(1200)
    const m = g.manly, capy = g.capy, b = capy.body
    const o = { events: [], tries: 0 }
    // WHAT THE CAMERA IS DOING AT THE MOMENT ITSELF
    g.events.on('task:complete', function (e) {
      const cam = g.camera, p = capy.position
      const dx = cam.position.x - p.x, dy = cam.position.y - p.y, dz = cam.position.z - p.z
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz)
      const flat = Math.sqrt(dx*dx + dz*dz)
      o.events.push({
        id: e && e.id, t: +g.state.time.toFixed(2),
        capy: [+p.x.toFixed(1), +p.y.toFixed(2), +p.z.toFixed(1)],
        cam:  [+cam.position.x.toFixed(1), +cam.position.y.toFixed(2), +cam.position.z.toFixed(1)],
        dist: +dist.toFixed(2), flat: +flat.toFixed(2),
        // yaw = bearing FROM the animal TO the camera, degrees, 0 = +z
        yawDeg: +(Math.atan2(dx, dz) * 180 / Math.PI).toFixed(1),
        pitchDeg: +(Math.atan2(dy, flat) * 180 / Math.PI).toFixed(1),
        raise: +dy.toFixed(2),
        rig: m.rig(),
        speed: +Math.sqrt(capy.velocity.x*capy.velocity.x + capy.velocity.z*capy.velocity.z).toFixed(2),
        rideDist: +m.rideDist().toFixed(1),
        swimming: !!capy.swimming, wet: +(capy.wet||0).toFixed(2),
        depth: +(capy.depth||0).toFixed(2)
      })
    })
    // ---- put it out the back and let the sea do the work ----
    const bankZ = m.bank().z
    o.bankZ = +bankZ.toFixed(1)
    // sample the rig DURING a ride too
    let rigSeen = null, maxSpeed = 0, maxRide = 0
    for (let attempt = 0; attempt < 26 && !o.events.some(e => e.id === 'all-the-way'); attempt++) {
      o.tries++
      b.position.set(0, 0.6, bankZ - 4); b.velocity.set(0, 0, 0)
      capy.wet = 0
      for (let i = 0; i < 900; i++) {
        g.tick(1/60, false)
        const sp = Math.sqrt(capy.velocity.x*capy.velocity.x + capy.velocity.z*capy.velocity.z)
        if (sp > maxSpeed) maxSpeed = sp
        const rd = m.rideDist(); if (rd > maxRide) maxRide = rd
        const r = m.rig()
        if (r && (!rigSeen || r.w > rigSeen.w)) rigSeen = { w: +r.w.toFixed(2), dist: r.dist, pitch: r.pitch, raise: r.raise }
        if (o.events.some(e => e.id === 'all-the-way')) break
      }
      await sleep(0)
    }
    o.maxSpeed = +maxSpeed.toFixed(2); o.maxRide = +maxRide.toFixed(1); o.rigSeen = rigSeen
    o.pos = [+capy.position.x.toFixed(1), +capy.position.z.toFixed(1)]
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-2.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
