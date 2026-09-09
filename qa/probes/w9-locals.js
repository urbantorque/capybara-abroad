async page => {
  await page.reload(); await page.waitForTimeout(5000)
  await page.mouse.click(400, 400); await page.waitForTimeout(2000)
  const out = {}
  for (const n of ['venice','kowloon']) {
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE, CANNON = g.CANNON
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<90;i++) g.tick(1/60,false)
      const api = g[name]
      // every static/kinematic collider as an AABB
      const boxes = []
      for (const bd of g.world.bodies) {
        if (bd.mass > 0 && bd.type !== 4) continue
        let skip = false
        for (const sh of bd.shapes) { const t = sh.constructor && sh.constructor.name
          if (t === 'Heightfield' || t === 'Plane') skip = true }
        if (skip) continue
        bd.updateAABB()
        const lo = bd.aabb.lowerBound, hi = bd.aabb.upperBound
        if (!(lo.x === lo.x)) continue
        boxes.push([lo.x, lo.y, lo.z, hi.x, hi.y, hi.z])
      }
      const bad = []
      const locals = (g.locals || g.npcLocals || []).slice ? (g.locals||g.npcLocals) : []
      const list = g.__localList || locals
      const ray = new THREE.Raycaster(); ray.far = 1.2
      const meshes = []
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p=o;p;p=p.parent) if (!p.visible) return
        const m = Array.isArray(o.material)?o.material[0]:o.material
        if (!m || m.transparent) return
        meshes.push(o)
      })
      const recs = []
      // locals live wherever npc.js keeps them; find groups whose name hints
      g.scene.traverse(o => { if (o.isGroup && o.userData && o.userData.local) recs.push(o) })
      return { boxes: boxes.length, recsFound: recs.length,
               keys: Object.keys(g).filter(k => /local|npc/i.test(k)) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=w9.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
