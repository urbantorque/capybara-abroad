async page => {
  await page.reload()
  await page.waitForTimeout(4500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio','iceland','sahara','drift','venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(700)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy
      const snap = []
      for (const b of g.world.bodies) {
        if (b.type !== 4 && b.mass !== 0) continue
        snap.push({ b, x: b.position.x, y: b.position.y, z: b.position.z, kine: b.type === 4 })
      }
      for (let i = 0; i < 180; i++) g.tick(1/60, false)
      const dt = 180/60
      const rows = []
      for (const s of snap) {
        const b = s.b
        const dx = b.position.x - s.x, dy = b.position.y - s.y, dz = b.position.z - s.z
        const moved = Math.hypot(dx, dy, dz)
        const vmag = Math.hypot(b.velocity.x, b.velocity.y, b.velocity.z)
        if (moved < 0.05) continue
        rows.push({ kine: s.kine, moved: +moved.toFixed(2), impliedV: +(moved/dt).toFixed(2),
                    reportedV: +vmag.toFixed(2), shapes: b.shapes.map(sh=>sh.constructor.name).join('+'),
                    y: +b.position.y.toFixed(1) })
      }
      const bad = rows.filter(r => r.impliedV > 0.15 && r.reportedV < 0.1 * r.impliedV)
      return { movers: rows.length, silent: bad.length, bad: bad.slice(0,8), all: rows.slice(0,10) }
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=kine.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
