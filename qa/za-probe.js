async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(1500)
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    const R = {}
    // ---- locals y vs terrain, per biome
    for (const name of ['palawan','goreme']) {
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      for (let i=0;i<40;i++) g.tick(1/60,false)
      const api = g[name]
      const rows = []
      const L = g.npcLocals ? g.npcLocals() : null
      R[name] = { spawnTerr: api.terrainHeight(sp.x, sp.z) }
    }
    // ---- goreme: crew geometry + herd lane
    g.biome.switchTo('goreme')
    const gg = g.goreme
    R.gorCrews = []
    // reach into the module through the api's published hooks
    R.gorEnvelope = (function(){ const v = gg.envelope(); return [v.x, v.y===undefined?null:v.y, v.z] })()
    R.gorMouth = (function(){ const v = gg.mouth(); return [v.x, v.y===undefined?null:v.y, v.z] })()
    // ---- tether collider: is there a static body at (-17, ~gy+2.4, 2)?
    R.tetherBodies = []
    for (const b of g.world.bodies) {
      if (b.mass > 0) continue
      if (Math.abs(b.position.x + 17) < 3 && Math.abs(b.position.z - 2) < 3) {
        R.tetherBodies.push([b.position.x, b.position.y, b.position.z, b.shapes.length])
      }
    }
    // ---- shadow casters that should not be
    const bad = {}
    for (const name of ['palawan','goreme']) {
      g.biome.switchTo(name)
      for (let i=0;i<30;i++) g.tick(1/60,false)
      const list = []
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh)) return
        if (!o.castShadow) return
        const m = Array.isArray(o.material) ? o.material[0] : o.material
        if (!m) return
        if (!(m.transparent || m.depthWrite === false || m.blending === THREE.AdditiveBlending || m.fog === false)) return
        const gm = o.geometry
        const t = gm && gm.index ? gm.index.count/3 : (gm && gm.attributes.position ? gm.attributes.position.count/3 : 0)
        let nm = o.name || o.type, q = o.parent, guard=0
        while (q && guard++ < 4) { if (q.name) nm = q.name + '/' + nm; q = q.parent }
        list.push([nm, Math.round(t * (o.isInstancedMesh ? o.count : 1)), o.visible])
      })
      list.sort((a,b2)=>b2[1]-a[1])
      bad[name] = list
    }
    R.ghostCasters = bad
    return R
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=zaprobe.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
