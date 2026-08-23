async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const names = ['sydney','quay','pasto','kyoto','cali','rio']
  const out = {}
  for (const n of names) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const s = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(s.x, s.y, s.z); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      g.renderer.setSize(1280, 760, false)
      g.camera.aspect = 1280/760; g.camera.updateProjectionMatrix()
      window.__errs = []
      if (!window.__hooked) { window.__hooked = 1
        const oe = console.error
        console.error = function(...a){ (window.__errs||[]).push(a.map(x=>(x&&x.stack)||String(x)).join(' ')); oe.apply(console,a) } }
    }, n)
    await page.waitForTimeout(2600)
    const counts = await page.evaluate((name) => {
      const g = window.__capy
      const root = g.scene.getObjectByName(name) || (name==='sydney' ? g.scene.getObjectByName('environment') : null)
      let tris = 0, meshes = 0, inst = 0
      const snap = []
      const walk = (o) => {
        for (let p = o; p; p = p.parent) if (!p.visible) return
        snap.push([o, o.position.x, o.position.y, o.position.z])
        if (o.isMesh || o.isInstancedMesh) {
          const gm = o.geometry
          const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
          const c = o.isInstancedMesh ? (o.count||0) : 1
          tris += t*c; meshes++; if (o.isInstancedMesh) inst += c
        }
        o.children.forEach(walk)
      }
      if (root) walk(root)
      const all = []
      g.scene.traverse(o => {
        for (let p = o; p; p = p.parent) if (!p.visible) return
        if (o !== g.capy.group) all.push([o, o.position.x, o.position.y, o.position.z])
      })
      window.__snap = all
      const locals = (g.locals||[]).filter(l => l.biome === name).length
      return { root: !!root, ktris: Math.round(tris/1000), meshes, inst, objs: snap.length,
               vis: window.__snap.length, locals, bodies: (g.world && g.world.bodies ? g.world.bodies.length : 0) }
    }, n)
    const perf = await page.evaluate(() => new Promise(res => {
      const g = window.__capy, t = []
      g.renderer.info.autoReset = false; g.renderer.info.reset()
      let last = performance.now(), i = 0
      const step = () => {
        const now = performance.now(); t.push(now-last); last = now
        if (++i < 150) requestAnimationFrame(step)
        else { const inf = g.renderer.info.render
               g.renderer.info.autoReset = true
               t.sort((a,b)=>a-b)
               res({ med:+t[75].toFixed(2), p95:+t[142].toFixed(2), max:+t[149].toFixed(2),
                     calls: Math.round(inf.calls/150), dktris: Math.round(inf.triangles/150/1000) }) }
      }
      requestAnimationFrame(step)
    }))
    await page.waitForTimeout(2200)
    const life = await page.evaluate(() => {
      let moved = 0
      for (const [o,x,y,z] of window.__snap)
        if (Math.abs(o.position.x-x)+Math.abs(o.position.y-y)+Math.abs(o.position.z-z) > 0.03) moved++
      return { moved }
    })
    const fuzz = await page.evaluate(async (name) => {
      const g = window.__capy
      const KEYS = ['KeyW','KeyA','KeyS','KeyD','Space','KeyE','KeyQ','ShiftLeft']
      const down = c => window.dispatchEvent(new KeyboardEvent('keydown',{code:c,bubbles:true}))
      const up = c => window.dispatchEvent(new KeyboardEvent('keyup',{code:c,bubbles:true}))
      let s = 987654 ^ name.length*7919
      const rnd = () => { s^=s<<13; s^=s>>>17; s^=s<<5; return ((s>>>0)%100000)/100000 }
      let nan = 0, stuck = 0, minY = 1e9, maxSpd = 0, lastX = 0, lastZ = 0
      const held = new Set(), t0 = performance.now()
      while (performance.now()-t0 < 6000) {
        if (rnd() < 0.09) { const k = KEYS[(rnd()*KEYS.length)|0]
          if (held.has(k)) { up(k); held.delete(k) } else { down(k); held.add(k) } }
        await new Promise(r => setTimeout(r, 16))
        const p = g.capy.position, v = g.capy.body.velocity, c = g.camera.position
        if (!(p.x===p.x&&p.y===p.y&&p.z===p.z)) nan++
        if (!(v.x===v.x&&v.y===v.y&&v.z===v.z)) nan++
        if (!(c.x===c.x&&c.y===c.y&&c.z===c.z)) nan++
        if (p.y < minY) minY = p.y
        const sp = Math.hypot(v.x,v.y,v.z); if (sp > maxSpd) maxSpd = sp
        if (Math.hypot(p.x-lastX,p.z-lastZ) < 0.004 && held.size) stuck++
        lastX = p.x; lastZ = p.z
      }
      for (const k of held) up(k)
      return { nan, stuck, minY:+minY.toFixed(1), maxSpd:+maxSpd.toFixed(1),
               solverSaves: g.state.solverSaves||0, lastError: g.state.lastError||null,
               errs: (window.__errs||[]).slice(0,4) }
    }, n)
    out[n] = Object.assign({}, counts, perf, life, fuzz)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=z2A.json', { method:'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
