async page => {
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('goreme')
    const sp = g.biome.spawnOf('goreme'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  })
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, A = g.goreme
    // every drawn point in world space
    const pts = []
    const m = new T.Matrix4(), v = new T.Vector3()
    g.scene.traverse(o => {
      for (let p = o; p; p = p.parent) if (!p.visible) return
      if (o.isInstancedMesh) {
        const n = Math.min(o.count, 4000)
        for (let i = 0; i < n; i++) {
          o.getMatrixAt(i, m); v.setFromMatrixPosition(m).applyMatrix4(o.matrixWorld)
          if (Math.abs(v.x) < 900 && Math.abs(v.z) < 900) pts.push([v.x, v.y, v.z])
        }
      } else if (o.isMesh) {
        v.setFromMatrixPosition(o.matrixWorld)
        const gm = o.geometry
        let tri = gm && gm.attributes && gm.attributes.position ? gm.attributes.position.count/3 : 0
        if (tri > 3000) return  // terrain / sky / big sheets are not "things"
        if (Math.abs(v.x) < 900 && Math.abs(v.z) < 900) pts.push([v.x, v.y, v.z])
      }
    })
    // the main route as a polyline of named waypoints
    const W = [ ['spawn',0,34], ['field',A.field.x,A.field.z], ['tether',A.tether.x,A.tether.z],
                ['plaza',A.plaza.x,A.plaza.z], ['cliff',A.cliff.x,A.cliff.z],
                ['chimney',A.chimney.x,A.chimney.z], ['valley',A.valley.x,A.valley.z],
                ['landing',A.landing.x,A.landing.z] ]
    const cells = []
    for (let s = 0; s < W.length-1; s++) {
      const a = W[s], b = W[s+1]
      const L = Math.hypot(b[1]-a[1], b[2]-a[2])
      const n = Math.max(1, Math.round(L/20))
      for (let k = 0; k < n; k++) {
        const t = (k+0.5)/n
        const x = a[1] + (b[1]-a[1])*t, z = a[2] + (b[2]-a[2])*t
        let c = 0
        for (let i = 0; i < pts.length; i++) {
          const dx = pts[i][0]-x, dz = pts[i][2]-z
          if (dx*dx + dz*dz < 196) c++
        }
        cells.push([a[0]+'->'+b[0], Math.round(x), Math.round(z), c])
      }
    }
    // nearest local to a set of places
    const locs = (g.locals||[]).filter(l => l.biome === 'goreme').map(l => [Math.round(l.x), Math.round(l.z)])
    return { nPts: pts.length, cells, locs, W }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-6.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, out)
}
