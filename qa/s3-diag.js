async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2000)
  const names = ['drift','venice','kowloon']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<120;i++) g.tick(1/60,false)
      // triangle walk
      let tris = 0, calls = 0, meshes = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        meshes++
        const gm = o.geometry
        if (!gm) return
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += t * (o.isInstancedMesh ? o.count : 1)
      })
      g.tick(1/60, true)
      calls = g.renderer.info.render.calls
      // random-input soak
      const keys = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE']
      let bad = 0, nan = 0, minY = 1e9, maxY = -1e9
      const st = { }
      let seed = 12345
      const rnd = () => { seed = (seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff }
      for (let step = 0; step < 60*90; step++) {
        if (step % 22 === 0) {
          for (const k of keys) g.input.keys[k] = rnd() < 0.35
        }
        g.tick(1/60, false)
        const p = b.position
        if (!(p.x===p.x && p.y===p.y && p.z===p.z)) { nan++; b.position.set(sp.x,sp.y,sp.z); b.velocity.set(0,0,0) }
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
        if (p.y < -80) { bad++; b.position.set(sp.x,sp.y,sp.z); b.velocity.set(0,0,0) }
      }
      for (const k of keys) g.input.keys[k] = false
      // props under terrain / asleep in air
      const api = g[name]
      let underProps = 0
      // task pointers
      const tasks = (g.tasks && g.tasks.list) ? g.tasks.list() : null
      return { tris: Math.round(tris), calls, meshes, bodies: g.world.bodies.length,
               nan, voidFalls: bad, minY: +minY.toFixed(1), maxY: +maxY.toFixed(1),
               err: g.state.lastError ? String(g.state.lastError).slice(0,300) : null,
               pos: [+b.position.x.toFixed(1), +b.position.y.toFixed(1), +b.position.z.toFixed(1)] }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=s3diag.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
