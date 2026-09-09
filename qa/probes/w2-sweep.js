async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1800)
  const out = {}
  for (const n of ['venice','kowloon']) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), cb = g.capy.body
      cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0,0,0)
      cb.previousPosition.copy(cb.position); cb.interpolatedPosition.copy(cb.position)
      await sleep(400)
      const api = g[name]
      const r = { name }
      // ---- kinematic bodies with zero velocity but a moving mesh
      const kin = []
      for (const b of g.world.bodies) {
        if (b.type !== 4) continue
        kin.push({ y: +b.position.y.toFixed(2), z: +b.position.z.toFixed(2),
                   sleep: b.allowSleep, shapes: b.shapes.length })
      }
      r.kinematic = kin.length
      r.kinSleepy = kin.filter(k => k.sleep).length
      // ---- materials that are transparent with depthWrite on (sorting bugs)
      const badTrans = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p=o; p; p=p.parent) if (!p.visible) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m) return
        if (m.transparent && m.depthWrite && m.opacity < 0.99) badTrans.push(o.name || m.type + ':' + m.color.getHexString())
      })
      r.transparentDepthWrite = badTrans
      // ---- instanced meshes with no colour attribute but vertexColors true (renders black)
      const blackRisk = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m || !m.vertexColors) return
        if (!o.geometry || !o.geometry.attributes.color) blackRisk.push(o.type + ' ' + (o.name||''))
      })
      r.vertexColorNoAttr = blackRisk
      // ---- meshes below the terrain / floating
      r.lastError = g.state.lastError || null
      return r
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=w2sweep.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
