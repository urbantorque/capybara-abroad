async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      await sleep(1800)
      let tris = 0, shadowTris = 0, transTris = 0
      let solo = 0, inst = 0, instances = 0, lights = 0
      const geos = new Set(), mats = new Set()
      const per = []
      g.scene.traverse(o => {
        if (o.isLight) { lights++; return }
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        geos.add(gm.uuid)
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (m) mats.add(m.uuid)
        const t = gm.index ? gm.index.count/3 : (gm.attributes.position ? gm.attributes.position.count/3 : 0)
        const cnt = o.isInstancedMesh ? o.count : 1
        const tot = t * cnt
        tris += tot
        if (o.castShadow) shadowTris += tot
        if (m && (m.transparent || m.depthWrite === false)) transTris += tot
        if (o.isInstancedMesh) { inst++; instances += cnt } else { solo++ }
        let nm = o.name || o.type, q = o.parent, guard = 0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        per.push([Math.round(tot), cnt, Math.round(t), nm, o.isInstancedMesh ? 'I' : '-'])
      })
      per.sort((a,c) => c[0]-a[0])
      // physics
      let bodies = 0, shapes = 0, statics = 0, kine = 0, dyn = 0
      for (const bd of g.world.bodies) {
        bodies++; shapes += bd.shapes.length
        if (bd.type === g.CANNON.Body.KINEMATIC) kine++
        else if (bd.mass > 0) dyn++
        else statics++
      }
      // people and props
      const locals = (g.npc && g.npc.localsIn) ? g.npc.localsIn(name) : null
      let props = 0
      if (g.props && g.props.length) for (const p of g.props) props++
      let npcs = 0
      if (g.npcs && g.npcs.length) npcs = g.npcs.length
      g.tick(1/60, true)
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris), transTris: Math.round(transTris),
               meshes: solo + inst, solo, instMeshes: inst, instances,
               geos: geos.size, mats: mats.size, lights,
               bodies, shapes, statics, kine, dyn, props, npcs,
               calls: g.renderer.info.render.calls,
               top: per.slice(0, 12), err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=census.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
