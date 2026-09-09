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
    const o = { fired: [], runs: [] }
    g.events.on('task:complete', e => o.fired.push({ id: e && e.id, z: +capy.position.z.toFixed(1),
      camPitch: null }))
    const bankZ = m.bank().z
    // BEST OF SIX drift runs from behind the bank. No input at all: the memory
    // says a ride is a fixed point and needs none.
    for (let run = 0; run < 6; run++) {
      b.position.set(0, 0.6, bankZ - 6); b.velocity.set(0, 0, 0)
      const R = { z0: +bankZ.toFixed(1), trace: [], maxRide: 0, maxZ: -99, camAtPeak: null, peakW: 0 }
      for (let i = 0; i < 2400; i++) {
        g.tick(1/60, false)
        const p = capy.position, w = m.wave(p.x, p.z)
        const rd = m.rideDist(); if (rd > R.maxRide) R.maxRide = +rd.toFixed(1)
        if (p.z > R.maxZ) R.maxZ = +p.z.toFixed(1)
        const rig = m.rig()
        if (rig && rig.w > R.peakW) {
          R.peakW = +rig.w.toFixed(2)
          const cam = g.camera
          const dx = cam.position.x - p.x, dy = cam.position.y - p.y, dz = cam.position.z - p.z
          const flat = Math.sqrt(dx*dx + dz*dz)
          R.camAtPeak = { flat: +flat.toFixed(2), raise: +dy.toFixed(2),
                          pitchDeg: +(Math.atan2(dy, flat)*180/Math.PI).toFixed(1),
                          yawDeg: +(Math.atan2(dx, dz)*180/Math.PI).toFixed(1),
                          dist: +Math.sqrt(dx*dx+dy*dy+dz*dz).toFixed(2) }
        }
        if (i % 120 === 0) R.trace.push([+p.z.toFixed(1), +w.push.toFixed(2), +w.foam.toFixed(2),
                                         +rd.toFixed(1), capy.swimming ? 1 : 0])
        if (p.z > 26) break
      }
      R.endZ = +capy.position.z.toFixed(1)
      R.netZ = +(capy.position.z - (bankZ - 6)).toFixed(1)
      o.runs.push(R)
      await sleep(0)
    }
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-3.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
