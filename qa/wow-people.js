async page => {
  // ONE PERSON — the instrument (ROADMAP-WOW, Part C).
  //
  // Every chapter, every instanced person pool that is live in it:
  //   ratio   head bounding-box height / figure height, standing instances
  //           only (a sitter's body is squashed, a child's head is meant to
  //           be big), median per pool, must sit in 0.19..0.21. "Figure" is
  //           feet to the top of the skull box; hair is a garment.
  //   eyes    a face pool with as many instances as the head pool (or the
  //           eyes merged into the head buffer itself, as the six pursuers)
  //   torso   >= 2 distinct colours in the body pool's own colour attribute
  //           (the shoulders/hem/placket bands), before any instance colour
  //
  // Pools are found by SHAPE, not by name: a head pool is an InstancedMesh
  // whose geometry's bounding box is the roster skull (0.32 wide, neck at
  // -0.07, crown between 0.31 and 0.38). Its body is the sibling pool with
  // the same count whose bbox is over a metre tall; its face the sibling with
  // the eyes' 144 (or eyes+mouth 180) vertices. A pool counts as live in a
  // chapter when it is visible and one standing instance is within 120 m of
  // the animal — the roster's meshes are always in the scene and park their
  // instances when their chapter is not up.
  //
  // Chapters after the first are reached by hud.cross(name) (trap 36: digit
  // keys are the title card's, biome.switchTo() moves nothing).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const CH = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift',
              'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave',
              'antarctic', 'monaco', 'hanoi']
  const out = { rows: [], errs, fails: [] }

  for (let ci = 0; ci < CH.length; ci++) {
    const name = CH[ci]
    if (ci > 0) {
      await page.evaluate((n) => window.__capy.hud.cross(n), name)
      await page.waitForTimeout(9500)
    }
    let rows
    try {
      rows = await page.evaluate((chapter) => {
        const g = window.__capy, T = g.THREE
        const cp = g.capy.position
        const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
        const bb = new T.Box3()
        function box(o) { const ge = o.geometry; if (!ge.boundingBox) ge.computeBoundingBox(); return ge.boundingBox }
        function shown(o) { for (let x = o; x; x = x.parent) if (x.visible === false) return false; return true }
        function inst(o) {
          const rows = []
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m); m.decompose(p, q, s)
            rows.push({ i, x: p.x, y: p.y, z: p.z, sx: s.x, sy: s.y, sz: s.z })
          }
          return rows
        }
        function colours(o) {
          const c = o.geometry.attributes.color
          if (!c) return 0
          const set = new Set()
          for (let i = 0; i < c.count; i++) set.add(c.getX(i).toFixed(3) + ',' + c.getY(i).toFixed(3) + ',' + c.getZ(i).toFixed(3))
          return set.size
        }
        const all = []
        g.scene.traverse(o => { if (o.isInstancedMesh && o.count > 0 && shown(o)) all.push(o) })
        const heads = all.filter(o => {
          const b = box(o)
          const w = b.max.x - b.min.x, h = b.max.y - b.min.y
          return Math.abs(b.min.y + 0.07) < 0.015 && b.max.y > 0.31 && b.max.y < 0.38 && w > 0.30 && w < 0.36 && h < 0.46
        })
        const res = []
        for (const hd of heads) {
          const hrows = inst(hd)
          const sibs = all.filter(o => o !== hd && o.parent === hd.parent && o.count === hd.count)
          // the roster's torso pool FIRST (0.715..1.31, its instance at the feet):
          // the roster also has a 1.30 m rake pool at the same count, and the
          // first sweep took that for the body
          let body = null, bodyH = 0
          for (const o of sibs) { const b = box(o); if (b.min.y > 0.6 && b.min.y < 0.8 && b.max.y > 1.25 && b.max.y < 1.4) body = o }
          if (!body) for (const o of sibs) { const b = box(o); const h = b.max.y - b.min.y; if (h > 1.0 && b.min.y < 0.1 && h > bodyH) { body = o; bodyH = h } }
          if (!body) continue   // a head-shaped pool with no body beside it is not a person pool
          const hv = hd.geometry.attributes.position.count
          const face = sibs.find(o => { const n = o.geometry.attributes.position.count; return (n === 144 || n === 180) && (box(o).max.y - box(o).min.y) < 0.2 })
          const eyesMerged = hv >= 108 + 144
          const brows = inst(body || hd)
          const hb = box(hd)
          const skull = 0.32   // the skull box; the neck below it is not the head
          const ratios = []
          let near = false
          for (let i = 0; i < hrows.length; i++) {
            const h = hrows[i], b = brows[i]
            if (!b) continue
            const d = Math.hypot(h.x - cp.x, h.z - cp.z)
            if (d > 120) continue
            near = true
            // standing: the head's y scale is the body's. A sitter's body is
            // squashed in y and its head is not; a child's head is 1.22 of its
            // body (the tell, by design). The body's x is NOT compared — the
            // roster's heavy and thin builds are a girth on x alone.
            if (Math.abs(h.sy - b.sy) > 0.05 * b.sy) continue
            const top = h.y + skull * h.sy      // skull top, world
            const feet = b.y
            const fig = top - feet
            if (fig < 1.0 || fig > 2.2) continue
            ratios.push((skull * h.sy) / fig)
          }
          if (!near) continue
          ratios.sort((a, b) => a - b)
          const med = ratios.length ? ratios[ratios.length >> 1] : null
          res.push({
            chapter, head: hd.name || '(unnamed)', body: body ? (body.name || '(unnamed)') : null,
            count: hd.count, standing: ratios.length,
            ratio: med === null ? null : +med.toFixed(3),
            ratioMin: ratios.length ? +ratios[0].toFixed(3) : null,
            ratioMax: ratios.length ? +ratios[ratios.length - 1].toFixed(3) : null,
            eyes: eyesMerged ? 'merged' : (face ? face.count : 0),
            torsoColours: body ? colours(body) : 0,
          })
        }
        return res
      }, name)
    } catch (e) { errs.push(name + ': ' + String(e.message || e)); rows = [] }
    for (const r of rows) {
      r.pass = (r.ratio !== null && r.ratio >= 0.19 && r.ratio <= 0.21)
        && (r.eyes === 'merged' || r.eyes === r.count)
        && r.torsoColours >= 2
      if (!r.pass) out.fails.push(r.chapter + ':' + r.head)
      out.rows.push(r)
    }
    if (!rows.length) out.rows.push({ chapter: name, head: null, note: 'no live person pool' })
  }
  await page.evaluate(async (o) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    await fetch('/shot?name=WOW-people.json', { method: 'POST', body: b64 })
  }, out)
}
