async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, o = {}
    const root = g.scene.getObjectByName('cali')
    const pts = []
    const v = new (g.camera.position.constructor)()
    const m4 = new (g.camera.matrixWorld.constructor)()
    root.updateMatrixWorld(true)
    root.traverse(n => {
      if (n.isInstancedMesh) {
        const cnt = Math.min(n.count, 4000)
        for (let i = 0; i < cnt; i++) {
          n.getMatrixAt(i, m4); v.setFromMatrixPosition(m4); v.applyMatrix4(n.matrixWorld)
          pts.push([v.x, v.z])
        }
      } else if (n.isMesh) {
        v.setFromMatrixPosition(n.matrixWorld); pts.push([v.x, v.z])
      }
    })
    o.total = pts.length
    // locals + npc waypoints
    const locs = (g.locals || []).filter(L => L.biome === 'cali').map(L => [L.x, L.z])
    // ---- walk the legs of the route in 20 m cells -------------------------
    const c = g.cali
    const legs = [
      ['spawn->gato', [c.SPAWN.x, c.SPAWN.z], [c.gato.x, c.gato.z]],
      ['gato->bridge', [c.gato.x, c.gato.z], [c.bridge.x, c.bridge.z]],
      ['bridge->chiva', [c.bridge.x, c.bridge.z], [c.chiva.x, c.chiva.z]],
      ['mirador->cane', [c.mirador.x, c.mirador.z], [c.cane.x, c.cane.z]],
      ['cane->floor', [c.cane.x, c.cane.z], [c.floor.x, c.floor.z]],
      ['floor->cristo', [c.floor.x, c.floor.z], [c.cristo.x, c.cristo.z]],
      ['mirador->floor', [c.mirador.x, c.mirador.z], [c.floor.x, c.floor.z]],
    ]
    o.legs = legs.map(([nm, a, b]) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1])
      const cells = Math.max(1, Math.round(L / 20))
      const row = []
      for (let i = 0; i < cells; i++) {
        const t = (i + 0.5) / cells
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t
        let cnt = 0
        for (let k = 0; k < pts.length; k++) {
          const dx = pts[k][0] - x, dz = pts[k][1] - z
          if (dx * dx + dz * dz < 100) cnt++          // within 10 m of the cell centre
        }
        let near = 99
        for (const l of locs) near = Math.min(near, Math.hypot(l[0] - x, l[1] - z))
        row.push([+x.toFixed(0), +z.toFixed(0), cnt, +near.toFixed(0)])
      }
      return { leg: nm, len: +L.toFixed(0), cells: row }
    })
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3cali6.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
