async page => {
  await page.reload(); await page.waitForTimeout(5200)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('antarctic')
    const cb = g.capy.body
    cb.position.set(0, 7.2, 52); cb.velocity.set(0,0,0)
    await sleep(500)
    const r = { nearJetty: 0, nearBoat: 0, outOfWorld: 0, minZ: 1e9, maxZ: -1e9, samples: 0, worst: null }
    const t0 = performance.now()
    while (performance.now() - t0 < 20000) {
      await sleep(120)
      r.samples++
      for (let i = 0; i < 15; i++) {
        const p = g.antarctic.nearestFloe   // not per-index; use terrain probe instead
      }
      // walk the kinematic cylinder bodies (the floes)
      for (const b of g.world.bodies) {
        if (b.type !== g.CANNON.Body.KINEMATIC) continue
        if (!b.shapes[0] || b.shapes[0].constructor.name !== 'Cylinder') continue
        const x = b.position.x, z = b.position.z
        const rad = b.shapes[0].radiusTop
        if (z < r.minZ) r.minZ = Math.round(z)
        if (z > r.maxZ) r.maxZ = Math.round(z)
        if (Math.abs(x) > 230 || z > 140 || z < -520) r.outOfWorld++
        if (Math.abs(x - 0) < rad + 10 && z > 12 && z < 45) { r.nearJetty++; r.worst = [Math.round(x), Math.round(z), Math.round(rad)] }
        const bp = g.antarctic.boat.position
        if (Math.hypot(x - bp.x, z - bp.z) < rad + 8) r.nearBoat++
      }
    }
    r.err = g.state.lastError || null
    return r
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=bofloe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
