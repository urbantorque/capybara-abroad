async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__capy.biome.switchTo('quay') })
  await page.waitForTimeout(3000)
  const counts = await page.evaluate(() => {
    const g = window.__capy
    let tris = 0, meshes = 0, inst = 0, transp = 0
    const per = {}
    g.scene.traverse(o => {
      for (let p = o; p; p = p.parent) if (!p.visible) return
      if (!o.isMesh && !o.isInstancedMesh) return
      const gm = o.geometry
      const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
      const c = o.isInstancedMesh ? (o.count||0) : 1
      tris += t*c; meshes++; if (o.isInstancedMesh) inst += c
      if (o.material && o.material.transparent) transp++
      let chain = []
      for (let p = o; p; p = p.parent) if (p.name) chain.unshift(p.name)
      const key = chain.join('/') || '(anon)'
      per[key] = (per[key]||0) + t*c
    })
    const top = Object.entries(per).sort((a,b)=>b[1]-a[1]).slice(0,18)
    return { ktris: Math.round(tris/1000), meshes, inst, transp,
             bodies: g.world.bodies.length, npcs: (g.npcs||[]).length,
             props: (g.props||[]).length, top }
  })
  const perf = await page.evaluate(() => new Promise(res => {
    const g = window.__capy, t = []
    let last = performance.now(), i = 0
    const step = () => {
      const now = performance.now(); t.push(now-last); last = now
      if (++i < 150) requestAnimationFrame(step)
      else { t.sort((a,b)=>a-b)
             res({ med:+t[75].toFixed(2), p95:+t[142].toFixed(2),
                   calls:g.renderer.info.render.calls,
                   dtris:Math.round(g.renderer.info.render.triangles/1000) }) }
    }
    requestAnimationFrame(step)
  }))
  const out = Object.assign({}, counts, perf, { err: await page.evaluate(()=>window.__capy.state.lastError||null) })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=cq-base.json', { method:'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
