async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6500)
  const out = { errs: [] }

  // ---- 1. the landing ring -----------------------------------------------
  // Read off the INSTANCE MATRIX, which is what gets drawn. A flag saying the
  // ring fired proves the event reached the handler and nothing else.
  out.ring = await page.evaluate(async () => {
    const g = window.__capy
    const T = g.THREE
    // find the ring mesh: the only InstancedMesh parented to the capybara's
    // own group whose geometry is a ring
    let mesh = null
    g.scene.traverse(o => {
      if (mesh || !o.isInstancedMesh) return
      if (o.count >= 4 && o.count <= 6 && o.material && o.material.transparent &&
          o.material.depthWrite === false) mesh = o
    })
    if (!mesh) return { noMesh: true }
    const m4 = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
    const readLast = () => {
      mesh.getMatrixAt(mesh.count - 1, m4)
      m4.decompose(p, q, s)
      return { x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 1000) / 1000 }
    }
    const before = readLast()
    // drop the animal ten metres. body.position is the honest way in: the fall
    // speed has to be produced by gravity, not asserted.
    const st = g.capy.position
    g.capy.body.position.set(st.x, st.y + 11, st.z)
    g.capy.body.velocity.set(0, 0, 0)
    let peak = 0, peakAt = 0
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 25))
      const r = readLast()
      if (r.x > peak) { peak = r.x; peakAt = i }
    }
    // ...and a two-metre step, which must draw a SMALLER ring, not the same one
    await new Promise(r => setTimeout(r, 1200))
    const st2 = g.capy.position
    g.capy.body.position.set(st2.x, st2.y + 1.4, st2.z)
    g.capy.body.velocity.set(0, 0, 0)
    let small = 0
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 25))
      const r = readLast()
      if (r.x > small) small = r.x
    }
    return { count: mesh.count, before: before.x, bigDrop: peak, bigAt: peakAt, smallDrop: small }
  })

  // ---- 2. the dust pool ---------------------------------------------------
  out.dust = await page.evaluate(async () => {
    const g = window.__capy
    // the dust is an InstancedMesh of tetrahedra; find it by geometry type
    let mesh = null
    g.scene.traverse(o => {
      if (mesh || !o.isInstancedMesh) return
      if (o.geometry && o.geometry.type === 'TetrahedronGeometry') mesh = o
    })
    return mesh ? { count: mesh.count } : { noMesh: true }
  })

  // ---- 3. the hit flash ---------------------------------------------------
  // Throw a prop hard at the ground and watch its MATERIAL, which is the thing
  // the swap changes. Sampling every 16 ms over a 60 ms window: a flash that
  // never ends is as wrong as one that never starts, so both edges are read.
  out.flash = await page.evaluate(async () => {
    const g = window.__capy
    const props = (g.props || []).filter(p => p.body && !p.held && p.mesh && !p.mesh.isInstancedMesh)
    if (!props.length) return { noProps: true }
    const p = props[0]
    const was = p.mesh.material
    const c0 = was.color.getHexString()
    const here = g.capy.position
    p.body.position.set(here.x + 1, here.y + 6, here.z + 1)
    p.body.velocity.set(0, -14, 0)
    p.body.wakeUp()
    let sawFlash = 0, frames = 0, back = false
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 16))
      const now = p.mesh.material
      if (now !== was) { sawFlash++; frames++ }
      else if (sawFlash > 0) { back = true; break }
    }
    return { c0: c0, flashFrames: sawFlash, restored: back,
             sameMaterial: p.mesh.material === was }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p7-impact.json', { method: 'POST', body: s })
  }, out)
}
