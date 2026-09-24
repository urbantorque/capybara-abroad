async page => {
  // TEN T2d: one ray of the rock audit, taken apart (stone 3, from −x). Run
  // after ten-t2d-rock.js on the same page. Writes qa/ten-t2d-rayprobe.json.png.
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, C = g.CANNON, R = g.rio, st = R.rockStones()
    const cx = R.arpoadorRock.x, cz = R.arpoadorRock.z
    let mesh = null
    g.scene.traverse(o => { if (o.isMesh && !o.isInstancedMesh && Math.abs(o.position.x - cx) < 1e-3 && Math.abs(o.position.z - cz) < 1e-3) mesh = o })
    let rock = null
    for (const b of g.world.bodies) if (b.mass === 0 && b.shapes.length === st.length && b.shapes.every(s => s instanceof C.ConvexPolyhedron)) rock = b
    const s = st[3], gy = R.terrainHeight(s.x, s.z)
    const rows = []
    for (const dy of [0.5, 0.3, 0.7, 0.9]) {
      const far = Math.max(s.s, s.sz) + 4, a = Math.PI
      const ox = s.x + Math.cos(a) * far, oz = s.z + Math.sin(a) * far, y = gy + dy
      const rc = new T.Raycaster(new T.Vector3(ox, y, oz), new T.Vector3(1, 0, 0), 0, far)
      const h = rc.intersectObject(mesh, false)
      const hits = []
      const ray = new C.Ray(new C.Vec3(ox, y, oz), new C.Vec3(ox + far, y, oz))
      ray.intersectWorld(g.world, { mode: C.Ray.ALL, skipBackfaces: false, callback: r => { hits.push({ me: r.body === rock, d: +r.distance.toFixed(2), sh: r.body.shapes.indexOf(r.shape) }) } })
      rows.push({ dy, draw: h.slice(0, 3).map(x => +x.distance.toFixed(2)), phys: hits.slice(0, 6) })
    }
    const near = st.map((t, i) => ({ i, d: +Math.hypot(t.x - s.x, t.z - s.z).toFixed(2), s: +t.s.toFixed(2), sz: +t.sz.toFixed(2), big: t.big })).filter(t => t.d < 6)
    return { s: { x: +s.x.toFixed(2), z: +s.z.toFixed(2), s: +s.s.toFixed(2), sy: +s.sy.toFixed(2), sz: +s.sz.toFixed(2), yc: +(s.y - gy).toFixed(2) }, rows, near }
  })
  await page.evaluate((o) => fetch('/shot?name=ten-t2d-rayprobe.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
