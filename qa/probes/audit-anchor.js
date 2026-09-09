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
    await page.waitForTimeout(900)
    out[n] = await page.evaluate((name) => {
      const g = window.__capy, THREE = g.THREE
      const api = name === 'sydney' ? g.env : g[name]
      const terrF = api && api.terrainHeight ? api.terrainHeight.bind(api) : null
      const overF = api && api.isOverWater ? api.isOverWater.bind(api) : null
      const whF = api && api.waterHeightAt ? api.waterHeightAt.bind(api) : null
      const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
      const rows = []
      g.scene.traverse(o => {
        if (!o.isInstancedMesh) return
        let vis = true
        for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break }
        if (!vis || !o.count) return
        const gm = o.geometry
        if (!gm.boundingBox) gm.computeBoundingBox()
        const minY = gm.boundingBox.min.y, maxY = gm.boundingBox.max.y
        o.updateMatrixWorld(true)
        let nm = o.name || ''
        let par = o.parent, guard = 0
        while (par && guard++ < 5) { if (par.name) nm = nm ? par.name+'/'+nm : par.name; par = par.parent }
        const ds = []
        const step = Math.max(1, Math.floor(o.count / 200))
        let overW = 0
        for (let i = 0; i < o.count; i += step) {
          o.getMatrixAt(i, m4)
          m4.premultiply(o.matrixWorld)
          m4.decompose(pos, q, sc)
          if (!(pos.x === pos.x)) continue
          const base = pos.y + minY * sc.y
          let ref = terrF ? terrF(pos.x, pos.z) : 0
          if (!(ref === ref)) ref = 0
          if (overF && overF(pos.x, pos.z)) { overW++; if (whF) { const w = whF(pos.x, pos.z); if (w > ref) ref = w } }
          ds.push(base - ref)
        }
        if (!ds.length) return
        ds.sort((a,b)=>a-b)
        const med = ds[ds.length>>1]
        rows.push({ nm: nm || 'unnamed', cnt: o.count, n: ds.length,
          h: +(maxY - minY).toFixed(2),
          col: o.material && o.material.color ? '#'+o.material.color.getHexString() : '',
          med: +med.toFixed(2), lo: +ds[0].toFixed(2), hi: +ds[ds.length-1].toFixed(2),
          float: ds.filter(v=>v>0.35).length, bury: ds.filter(v=>v<-0.6).length, overW })
      })
      rows.sort((a,b)=>(b.float+b.bury)-(a.float+a.bury))
      return rows
    }, n)
  }
  await page.evaluate((o) => fetch('/shot?name=anchor.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
