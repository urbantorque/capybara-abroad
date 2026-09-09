async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = { steps: [] }
    function park(x, y, z) {
      const b = g.capy.body
      b.position.set(x, y, z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    }
    g.biome.switchTo('drift')
    const sp = g.biome.spawnOf('drift')
    park(sp.x, sp.y, sp.z)
    const d = g.drift
    // --- wake six lampflies in the orchard --------------------------------
    park(-38, d.terrainHeight(-38, -114) + 1.2, -114)
    for (let k = 0; k < 30 && d.lampflies() < 6; k++) {
      g.input.honkPressed = true; g.input.honk = true
      g.tick(1 / 60, false)
      g.input.honk = false
      for (let i = 0; i < 40; i++) g.tick(1 / 60, false)
    }
    R.flies = d.lampflies()
    // --- to the plinth, and light it --------------------------------------
    park(36, d.terrainHeight(36, -186) + 1.2, -186)
    R.beforeLit = d.lit()
    const cam = g.camera
    function camRead() {
      const L = { x: 36, y: 108, z: -190 }
      const dx = cam.position.x - L.x, dy = cam.position.y - L.y, dz = cam.position.z - L.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
      const yaw = Math.atan2(dx, dz) * 180 / Math.PI
      const pitch = Math.asin(dy / (dist || 1)) * 180 / Math.PI
      const cp = g.capy.position
      const ddx = cam.position.x - cp.x, ddy = cam.position.y - cp.y, ddz = cam.position.z - cp.z
      const cd = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz)
      return { yawToLantern: +yaw.toFixed(1), distToLantern: +dist.toFixed(1),
        pitch: +pitch.toFixed(1), camDistToCapy: +cd.toFixed(1),
        camY: +cam.position.y.toFixed(1), glow: +d.glow().toFixed(3) }
    }
    R.preCam = camRead()
    g.input.actionPressed = true; g.input.action = true
    g.tick(1 / 60, false)
    g.input.action = false
    R.lit = d.lit()
    for (let s = 0; s < 10; s++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      R.steps.push(Object.assign({ t: +((s + 1) * 0.5).toFixed(1) }, camRead()))
    }
    R.taskLantern = g.taskDone ? g.taskDone('lantern') : null
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri3.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
  await page.waitForTimeout(2500)
}
