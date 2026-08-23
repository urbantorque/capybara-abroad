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
      await sleep(1600)
      const live = new Set()
      for (const bd of g.world.bodies) live.add(bd.id)
      const inScene = (o) => { if (!o) return false; let p = o; while (p) { if (p === g.scene) return true; p = p.parent } return false }
      // props / npcs / locals that actually belong to THIS chapter right now
      let props = 0, propTris = 0
      for (const p of (g.props || [])) if (p && p.body && live.has(p.body.id)) props++
      let npcs = 0
      for (const p of (g.npcs || [])) if (p && p.group && inScene(p.group) && p.group.visible) npcs++
      let locals = 0
      for (const bd of g.world.bodies) if (bd.userData && bd.userData.local && bd.userData.local.biome === name) locals++
      let tris = 0, shadowTris = 0, solo = 0, inst = 0, instances = 0, lights = 0
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
        if (o.isInstancedMesh) { inst++; instances += cnt } else { solo++ }
        per.push([Math.round(tot), cnt, Math.round(t), o.isInstancedMesh ? 'inst' : 'mesh',
                  m && m.color ? '#' + m.color.getHexString() : ''])
      })
      per.sort((a,c) => c[0]-a[0])
      let bodies = 0, shapes = 0, statics = 0, kine = 0, dyn = 0
      for (const bd of g.world.bodies) {
        bodies++; shapes += bd.shapes.length
        if (bd.type === g.CANNON.Body.KINEMATIC) kine++
        else if (bd.mass > 0) dyn++
        else statics++
      }
      g.tick(1/60, true)
      return { tris: Math.round(tris), shadowTris: Math.round(shadowTris),
               meshes: solo + inst, solo, instMeshes: inst, instances,
               geos: geos.size, mats: mats.size, lights,
               bodies, shapes, statics, kine, dyn, props, npcs, locals,
               calls: g.renderer.info.render.calls,
               top: per.slice(0, 8), err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=census2.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
