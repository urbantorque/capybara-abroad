async page => {
  // T4c: how much of the drawn shells lies OUTSIDE the three camSolid shell
  // colliders — per cluster, the vertex count outside and the extent of it.
  // Run on a page already in Sydney (after ten-t4c-concert.js).
  const out = await page.evaluate(() => {
    const g = window.__capy, gl = g.scene.getObjectByName('envSailGlow')
    let shell = null
    g.scene.traverse(o => { if (o.isMesh && gl && o !== gl && o.geometry === gl.geometry) shell = o })
    const pos = shell.geometry.attributes.position, v = new g.THREE.Vector3()
    shell.updateMatrixWorld()
    const boxes = []
    for (const b of g.world.bodies) if (b.userData && b.userData.camSolid && b.shapes.length === 1 && b.mass === 0) {
      const h = b.shapes[0].halfExtents; if (!h) continue
      boxes.push({ x0: b.position.x - h.x, x1: b.position.x + h.x, y0: b.position.y - h.y, y1: b.position.y + h.y, z0: b.position.z - h.z, z1: b.position.z + h.z })
    }
    const cl = { hall: { n: 0, out: 0, ext: null }, theatre: { n: 0, out: 0, ext: null }, rest: { n: 0, out: 0, ext: null } }
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(shell.matrixWorld)
      const k = v.z > -0.2 && v.x < -8 ? 'rest' : v.x > -1 ? 'hall' : 'theatre'
      const c = cl[k]; c.n++
      let inside = false
      for (const b of boxes) if (v.x >= b.x0 - 0.05 && v.x <= b.x1 + 0.05 && v.y >= b.y0 - 0.05 && v.y <= b.y1 + 0.05 && v.z >= b.z0 - 0.05 && v.z <= b.z1 + 0.05) { inside = true; break }
      if (inside) continue
      c.out++
      const e = c.ext || (c.ext = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 })
      e.x0 = Math.min(e.x0, v.x); e.x1 = Math.max(e.x1, v.x); e.y0 = Math.min(e.y0, v.y); e.y1 = Math.max(e.y1, v.y); e.z0 = Math.min(e.z0, v.z); e.z1 = Math.max(e.z1, v.z)
    }
    for (const k in cl) if (cl[k].ext) for (const q in cl[k].ext) cl[k].ext[q] = +cl[k].ext[q].toFixed(2)
    return { boxes: boxes.map(b => { const r = {}; for (const q in b) r[q] = +b[q].toFixed(2); return r }), cl }
  })
  await page.evaluate(o => fetch('/shot?name=ten-t4c-shellbox.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
