async page => {
  // R4, THE THREE THINGS THAT CANNOT BE JUDGED BY EYE.
  //
  //  1. THE ANKLE BAND, off the shin's own `color` buffer: the mean linear
  //     multiplier below the ankle ring against the mean above it. A band that
  //     is "not visible in the render" is either absent or subtle and only the
  //     buffer says which.
  //  2. THE TOES, off the foot's own `position` buffer: the z of the tips
  //     against the z of the valleys, and how many of each.
  //  3. THE WINDING. A hand-authored geometry with a face wound the wrong way
  //     is invisible under backface culling and looks exactly like a modelling
  //     mistake. Sum the signed volume of the closed mesh: positive is
  //     outward-facing everywhere, and it is one number.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, shin: null, toes: [], vol: [], loaf: null }
    try {
      res.loaf = g.capy.loaf
      const legs = []
      g.capy.group.traverse(o => {
        if (o.isGroup && o.children.length === 2 &&
            o.children[0].isMesh && o.children[1].isMesh &&
            Math.abs(Math.abs(o.position.x) - 0.15) < 1e-6 &&
            Math.abs(o.position.z) > 0.2 && Math.abs(o.position.z) < 0.34) legs.push(o)
      })
      if (legs.length !== 4) throw new Error('legs ' + legs.length)
      legs.sort((a, b) => (b.position.z - a.position.z) || (b.position.x - a.position.x))

      // ---- 1. the band -----------------------------------------------------
      const shin = legs[0].children[0]
      const sp = shin.geometry.attributes.position, sc = shin.geometry.attributes.color
      if (!sc) throw new Error('shin has no color attribute')
      let loN = 0, loS = 0, hiN = 0, hiS = 0
      for (let i = 0; i < sp.count; i++) {
        const y = sp.getY(i), v = (sc.getX(i) + sc.getY(i) + sc.getZ(i)) / 3
        if (y < -0.101) { loN++; loS += v } else { hiN++; hiS += v }
      }
      const r4 = (n) => Math.round(n * 10000) / 10000
      res.shin = { belowN: loN, aboveN: hiN, below: r4(loS / loN), above: r4(hiS / hiN),
                   ratio: r4((loS / loN) / (hiS / hiN)),
                   // ...and the same ratio in sRGB terms, which is the number
                   // the roadmap wrote (0.82) and the one a person can judge
                   srgb: r4(Math.pow((loS / loN) / (hiS / hiN), 1 / 2.4)) }

      // ---- 2. the toes and 3. the winding ---------------------------------
      const va = new T.Vector3(), vb = new T.Vector3(), vc = new T.Vector3()
      for (const which of [0, 2]) {
        const foot = legs[which].children[1]
        const p = foot.geometry.attributes.position
        // the front edge of the foot in its own frame is +z; count the distinct
        // z values there and how far apart they are
        let maxZ = -9
        for (let i = 0; i < p.count; i++) if (p.getZ(i) > maxZ) maxZ = p.getZ(i)
        const tips = new Set(), vals = new Set()
        for (let i = 0; i < p.count; i++) {
          const z = p.getZ(i)
          if (z > maxZ - 1e-6) tips.add(Math.round(p.getX(i) * 1e4))
          else if (z > maxZ - 0.02) vals.add(Math.round(p.getX(i) * 1e4))
        }
        // signed volume: sum over triangles of (a . (b x c)) / 6
        let vol = 0
        for (let i = 0; i < p.count; i += 3) {
          va.fromBufferAttribute(p, i); vb.fromBufferAttribute(p, i + 1); vc.fromBufferAttribute(p, i + 2)
          vol += va.dot(vb.clone().cross(vc)) / 6
        }
        res.toes.push({ leg: which, which: which < 2 ? 'front' : 'rear',
                        tips: tips.size, valleys: vals.size,
                        tipX: [...tips].map(v => v / 1e4).sort((a, b) => a - b),
                        notch: Math.round((maxZ - [...new Set([...Array(p.count).keys()]
                          .map(i => p.getZ(i)).filter(z => z < maxZ - 1e-6 && z > maxZ - 0.02))]
                          .sort((a, b) => b - a)[0]) * 10000) / 10000 })
        res.vol.push({ which: which < 2 ? 'front' : 'rear', v: Math.round(vol * 1e7) / 1e7 })
      }
      // the shin too: it is open at the top, so its signed volume is not a
      // closed one — report the SIDE walls' outward-ness instead, as the sign
      // of the dot of each face normal with its own outward radial direction.
      {
        const p = shin.geometry.attributes.position
        let bad = 0, n = 0
        for (let i = 0; i < p.count; i += 3) {
          va.fromBufferAttribute(p, i); vb.fromBufferAttribute(p, i + 1); vc.fromBufferAttribute(p, i + 2)
          const cx = (va.x + vb.x + vc.x) / 3, cz = (va.z + vb.z + vc.z) / 3
          if (Math.sqrt(cx * cx + cz * cz) < 0.02) continue     // the sole cap
          const nrm = vb.clone().sub(va).cross(vc.clone().sub(va))
          n++
          if (nrm.x * cx + nrm.z * cz <= 0) bad++
        }
        res.shinWalls = { faces: n, inwardFacing: bad }
      }
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })

  // ---- the pictures a foot can actually be judged from: low, close, and from
  // in front, because the toes are on the front edge and every camera in the
  // game looks at this animal from above and behind.
  await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const W = 1280, H = 760
    g.renderer.setSize(W, H, false)
    const my = g.capy.group.rotation.y
    const p = g.capy.position
    // [name, yaw off the animal's heading, camera distance, camera height above
    //  the aim, how far along the body the aim sits, aim height off the ground]
    for (const s of [['toesF', 0.10, 0.85, 0.16, 0.62, 0.05],
                     ['toesR', Math.PI * 1.04, 0.85, 0.16, -0.58, 0.05],
                     ['ankle', Math.PI * 0.34, 1.30, 0.26, 0.34, 0.10],
                     ['low3q', Math.PI * 0.74, 1.9, 0.36, 0, 0.16]]) {
      const yaw = my + s[1]
      const aim = new T.Vector3(p.x + Math.sin(my) * s[4],
                                p.y - 0.34 + s[5],
                                p.z + Math.cos(my) * s[4])
      const c = new T.PerspectiveCamera(30, W / H, 0.01, 400)
      c.position.set(aim.x + Math.sin(yaw) * s[2], aim.y + s[3], aim.z + Math.cos(yaw) * s[2])
      c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
      g.renderer.render(g.scene, c)
      await fetch('/shot?name=R4a-' + s[0], { method: 'POST',
        body: g.renderer.domElement.toDataURL('image/png') })
    }
    // ...and THE RESTING LENS: the game's own camera, unmoved. Every close-up
    // above is a picture nobody will ever see; this is the frame the game
    // spends most of its time showing, and a detail that does not survive it
    // was not worth the triangles.
    g.renderer.render(g.scene, g.camera)
    await fetch('/shot?name=R4a-lens', { method: 'POST',
      body: g.renderer.domElement.toDataURL('image/png') })
  })

  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R4a-foot.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
