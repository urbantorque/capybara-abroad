async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['manly','pantanal']) {
    await page.evaluate((name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, n)
    await page.waitForTimeout(2500)
    out[n] = await page.evaluate(() => {
      const g = window.__capy
      let tris = 0, calls = 0
      g.scene.traverse(o => { if (!o.isMesh && !o.isInstancedMesh) return
        for (let p=o;p;p=p.parent) if (!p.visible) return
        calls++
        const gm=o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        tris += t * (o.isInstancedMesh ? (o.count||0) : 1) })
      const locals = (g.locals||[]).filter(r => r.biome === g.biome.current).length
      return { tris: Math.round(tris), meshes: calls, bodies: g.world.bodies.length,
               locals, err: g.state.lastError || null }
    })
  }
  // frame time
  out.perf = await page.evaluate(() => new Promise(res => {
    const g = window.__capy, ts = []
    let last = performance.now(), n = 0
    const step = () => { const t = performance.now(); ts.push(t - last); last = t
      if (++n < 240) requestAnimationFrame(step)
      else { ts.sort((a,b)=>a-b); res({ med: +ts[120].toFixed(1), p95: +ts[228].toFixed(1) }) } }
    requestAnimationFrame(step)
  }))
  await page.evaluate(async (o) => { await fetch('/shot?name=fcver.json',{method:'POST',body:btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
