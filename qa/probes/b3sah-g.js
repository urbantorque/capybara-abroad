async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy, THREE = g.THREE
    g.biome.switchTo('sahara')
    for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
    const sa = g.sahara
    // ---- every visible piece of geometry in the chapter, as world x/z -------
    const pts = []
    const v = new THREE.Vector3(), m = new THREE.Matrix4()
    g.scene.updateMatrixWorld(true)
    g.scene.traverse(o => {
      for (let p = o; p; p = p.parent) if (!p.visible) return
      if (o.isInstancedMesh) {
        const n = Math.min(o.count, 4000)
        for (let i = 0; i < n; i++) {
          o.getMatrixAt(i, m); m.premultiply(o.matrixWorld)
          v.setFromMatrixPosition(m); pts.push(v.x, v.z)
        }
      } else if (o.isMesh) {
        const gm = o.geometry
        if (gm && gm.attributes && gm.attributes.position && gm.attributes.position.count > 200000) return
        v.setFromMatrixPosition(o.matrixWorld); pts.push(v.x, v.z)
      }
    })
    // the ground plane / terrain is one big mesh at the origin, so drop points
    // that are the chapter's terrain (huge geometry) — done above by the cap.
    const CELL = 20
    const grid = {}
    for (let i = 0; i < pts.length; i += 2) {
      const k = Math.floor(pts[i] / CELL) + ',' + Math.floor(pts[i + 1] / CELL)
      grid[k] = (grid[k] || 0) + 1
    }
    const locals = g.locals.filter(r => r.biome === 'sahara')
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === 'sahara'))
    // ---- the town route ----------------------------------------------------
    const sp = g.biome.spawnOf('sahara')
    const legs = [
      ['spawn', sp.x, sp.z], ['cart', sa.cart.x, sa.cart.z], ['basket', sa.basket.x, sa.basket.z],
      ['acrobats', sa.acrobatMat().x, sa.acrobatMat().z], ['souk', sa.souk.x, sa.souk.z],
      ['koutoubia', sa.koutoubia.x, sa.koutoubia.z], ['gate', sa.gate.x, sa.gate.z],
      ['palm', sa.datePalm.x, sa.datePalm.z]
    ]
    const cells = []
    const seen = new Set()
    for (let L = 0; L < legs.length - 1; L++) {
      const [n0, x0, z0] = legs[L], [n1, x1, z1] = legs[L + 1]
      const d = Math.hypot(x1 - x0, z1 - z0)
      const steps = Math.max(1, Math.round(d / 5))
      for (let s = 0; s <= steps; s++) {
        const x = x0 + (x1 - x0) * s / steps, z = z0 + (z1 - z0) * s / steps
        const k = Math.floor(x / CELL) + ',' + Math.floor(z / CELL)
        if (seen.has(k)) continue
        seen.add(k)
        const cx = (Math.floor(x / CELL) + 0.5) * CELL, cz = (Math.floor(z / CELL) + 0.5) * CELL
        cells.push({ leg: n0 + '>' + n1, k, cx, cz, geo: grid[k] || 0,
          locals: locals.filter(r => Math.abs(r.x - cx) < CELL && Math.abs(r.z - cz) < CELL).length,
          props: props.filter(p => Math.abs(p.body.position.x - cx) < CELL && Math.abs(p.body.position.z - cz) < CELL).length })
      }
    }
    return { cells, totalPts: pts.length / 2, legs: legs.map(l => l[0] + ':' + l[1].toFixed(0) + ',' + l[2].toFixed(0)) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-g.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
