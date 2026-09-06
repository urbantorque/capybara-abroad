async page => {
  // R4 BASELINE. Three things that have to be measured BEFORE the feet change,
  // because two of them are the acceptance and the third is the reason the task
  // exists:
  //
  //  1. the budget (meshes / triangles), with the parent-visibility walk;
  //  2. the FOOTPRINT — each foot's world-space box in the rest pose. The
  //     hand-authored foot keeps the same 0.145 x 0.05 x 0.175, and the honest
  //     way to prove that is the drawn box, not the numbers in the source;
  //  3. the LOAF, which is what the task is about: where the rear feet sit in z
  //     against the back of the rump. Measured off the buffers with the pose
  //     live, so it is the drawn animal and not the constants.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  // capyLOAF_T is 6.5 s of rest, and the load above has done nothing for far
  // longer than that, so by here the animal IS in the loaf. Assert it rather
  // than assume it.
  const out = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const res = { err: null, tris: 0, meshes: 0, parts: [], feet: [], loaf: null, hull: null }
    try {
      res.loaf = g.capy.loaf
      let tris = 0, meshes = 0
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.visible || !o.geometry) return
        for (let q = o.parent; q && q !== g.capy.group; q = q.parent) if (!q.visible) return
        const p = o.geometry.attributes.position
        if (!p) return
        meshes++
        tris += (o.geometry.index ? o.geometry.index.count : p.count) / 3
      })
      res.tris = Math.round(tris); res.meshes = meshes

      // ---- the four feet and the four shins, by walking the leg groups: the
      // legs are children of capySquash and each holds exactly [shin, foot].
      const legs = []
      g.capy.group.traverse(o => {
        if (o.isGroup && o.children.length === 2 &&
            o.children[0].isMesh && o.children[1].isMesh &&
            Math.abs(Math.abs(o.position.x) - 0.15) < 1e-6 &&
            Math.abs(o.position.z) > 0.2 && Math.abs(o.position.z) < 0.34) legs.push(o)
      })
      if (legs.length !== 4) throw new Error('legs ' + legs.length)
      legs.sort((a, b) => (b.position.z - a.position.z) || (b.position.x - a.position.x))

      // MODEL SPACE, not world: the animal stands at z 21.5 in Sydney and a
      // world box cannot be compared with anything. Walk each mesh's world
      // matrix back through the inverse of the group's.
      g.capy.group.updateWorldMatrix(true, true)
      const inv = new T.Matrix4().copy(g.capy.group.matrixWorld).invert()
      const _m = new T.Matrix4()
      const boxOf = (m) => {
        const p = m.geometry.attributes.position
        const v = new T.Vector3()
        _m.multiplyMatrices(inv, m.matrixWorld)
        const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9]
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(_m)
          const a = [v.x, v.y, v.z]
          for (let k = 0; k < 3; k++) { if (a[k] < lo[k]) lo[k] = a[k]; if (a[k] > hi[k]) hi[k] = a[k] }
        }
        const r = (n) => Math.round(n * 1000) / 1000
        return { lo: lo.map(r), hi: hi.map(r), size: [r(hi[0] - lo[0]), r(hi[1] - lo[1]), r(hi[2] - lo[2])] }
      }
      // ...and the one number that says whether a pose is DRAWN or merely
      // written: how far the lowest corner of the foot is under the ground the
      // player can see. The api is the live biome's own (game.env in Sydney).
      const api = g.biome && g.biome.current === 'sydney' ? g.env : (g[g.biome.current] || null)
      const terrAt = (x, z) => (api && typeof api.terrainHeight === 'function')
        ? api.terrainHeight(x, z) : 0
      const sinkOf = (m) => {
        const p = m.geometry.attributes.position
        const v = new T.Vector3()
        let worst = 9, cx = 0, cz = 0
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld)
          cx += v.x; cz += v.z
          const d = v.y - terrAt(v.x, v.z)
          if (d < worst) worst = d
        }
        return Math.round(worst * 1000) / 1000
      }
      res.biome = g.biome && g.biome.current

      for (let i = 0; i < 4; i++) {
        const shin = legs[i].children[0], foot = legs[i].children[1]
        const p = foot.geometry.attributes.position
        res.feet.push({
          leg: i, which: i < 2 ? 'front' : 'rear',
          rotX: Math.round(legs[i].rotation.x * 1000) / 1000,
          rotZ: Math.round(legs[i].rotation.z * 1000) / 1000,
          posZ: Math.round(legs[i].position.z * 1000) / 1000,
          footGeo: foot.geometry.type,
          footTris: Math.round((foot.geometry.index ? foot.geometry.index.count : p.count) / 3),
          shinGeo: shin.geometry.type,
          shinTris: Math.round((shin.geometry.index ? shin.geometry.index.count
                                                    : shin.geometry.attributes.position.count) / 3),
          // THE FOOTPRINT, in the foot's OWN frame with its own scale on. The
          // model-space box below is a box round a ROTATED foot and is not the
          // footprint; this is, and it is the number the acceptance is about.
          footprint: (() => {
            foot.geometry.computeBoundingBox()
            const b = foot.geometry.boundingBox, r = (n) => Math.round(n * 1000) / 1000
            return [r((b.max.x - b.min.x) * foot.scale.x),
                    r((b.max.y - b.min.y) * foot.scale.y),
                    r((b.max.z - b.min.z) * foot.scale.z)]
          })(),
          foot: boxOf(foot), sink: sinkOf(foot), shinSink: sinkOf(shin)
        })
      }
      // the hull, so the rear foot's z can be quoted against the back of the
      // animal rather than against a number
      let hull = null
      g.capy.group.traverse(o => { if (o.name === 'capyHull') hull = o })
      if (hull) res.hull = boxOf(hull)
      // ...and the question the roadmap's third term turns on: is the rear foot
      // OUTSIDE the flank above it? Take the hull's own widest |x| within 5 cm
      // of each foot's z, off the buffer, in the same model space.
      if (hull) {
        const hp = hull.geometry.attributes.position
        const hv = new T.Vector3()
        const hm = new T.Matrix4().multiplyMatrices(inv, hull.matrixWorld)
        res.flank = res.feet.map(f => {
          const zc = (f.foot.lo[2] + f.foot.hi[2]) * 0.5
          let w = 0
          for (let i = 0; i < hp.count; i++) {
            hv.fromBufferAttribute(hp, i).applyMatrix4(hm)
            if (Math.abs(hv.z - zc) > 0.12) continue   // the hull has 7 rings; a narrower window can fall between two
            if (Math.abs(hv.x) > w) w = Math.abs(hv.x)
          }
          const r = (n) => Math.round(n * 1000) / 1000
          return { which: f.which, footZ: r(zc), footOuterX: r(Math.max(Math.abs(f.foot.lo[0]),
                                                                       Math.abs(f.foot.hi[0]))),
                   hullHalfWidth: r(w), proudBy: r(Math.max(Math.abs(f.foot.lo[0]),
                                                            Math.abs(f.foot.hi[0])) - w) }
        })
      }
    } catch (e) { res.err = String((e && e.stack) || e) }
    return res
  })

  // ---- the pictures. The loaf first, because it is the pose this is about.
  await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
    const W = 1280, H = 760
    g.renderer.setSize(W, H, false)
    const my = g.capy.group.rotation.y
    const p = g.capy.position
    const aim = new T.Vector3(p.x, p.y - 0.04, p.z)
    for (const s of [['loaf3q', Math.PI * 0.78, 2.2, 0.45],
                     ['loafside', Math.PI * 0.5, 2.2, 0.30],
                     ['loafrear', Math.PI * 1.0, 2.2, 0.55],
                     ['feet', Math.PI * 0.30, 1.4, 0.30]]) {
      const yaw = my + s[1]
      const c = new T.PerspectiveCamera(26, W / H, 0.02, 400)
      c.position.set(aim.x + Math.sin(yaw) * s[2], aim.y + s[3], aim.z + Math.cos(yaw) * s[2])
      c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
      g.renderer.render(g.scene, c)
      await fetch('/shot?name=R4a-' + s[0], { method: 'POST',
        body: g.renderer.domElement.toDataURL('image/png') })
    }
  })

  out.errs = errs
  await page.evaluate(async o => {
    await fetch('/shot?name=R4a-result.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
