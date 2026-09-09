async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy
    const down = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }))
    const up = c => window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }))
    const wrap = a => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a }
    g.biome.switchTo('sahara')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const sa = g.sahara
    const SPOTS = [
      { n: 'S1-runout',  x: 206, z: 10,  yaw: -1.57 },   // at the foot, looking back E at the dune
      { n: 'S2-midrun',  x: 240, z: 10,  yaw: 1.57 },    // mid-face, default-ish rig looking W
      { n: 'S3-souk',    x: 0,   z: -38, yaw: 0 },
      { n: 'S4-medina',  x: -50, z: 10,  yaw: 0 },       // the geo-2 cell by the Koutoubia
      { n: 'S5-gateroad', x: 90, z: 10,  yaw: 1.57 },
      { n: 'S6-square',  x: 0,   z: 4,   yaw: 0 },
      { n: 'S7-crest',   x: 277, z: 10,  yaw: 1.57 },    // standing at the drop-in
    ]
    const res = []
    const b = g.capy.body
    g.renderer.setSize(1280, 760, false)
    g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
    for (const s of SPOTS) {
      const y = sa.terrainHeight(s.x, s.z) + 1.0
      const hold = () => { b.position.set(s.x, y, s.z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
      hold()
      for (let i = 0; i < 60; i++) { g.input.x = 0; g.input.z = 0; g.tick(1 / 60, false); hold() }
      for (let i = 0; i < 900; i++) {
        const d = wrap(s.yaw - g.input.camYaw)
        if (Math.abs(d) < 0.02) break
        const k = d > 0 ? 'KeyZ' : 'KeyX'
        down(k); g.tick(1 / 60, false); up(k); hold()
      }
      for (let i = 0; i < 120; i++) { g.tick(1 / 60, false); hold() }
      g.tick(1 / 60, true)
      const c = g.camera.position
      const url = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + s.n + '.png', { method: 'POST', body: url.split(',')[1] })
      res.push({ n: s.n, yaw: +g.input.camYaw.toFixed(2),
        cam: [+c.x.toFixed(1), +c.y.toFixed(1), +c.z.toFixed(1)],
        clear: +(c.y - sa.terrainHeight(c.x, c.z)).toFixed(1) })
    }
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-shots.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
