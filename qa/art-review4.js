async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(9000)
  const out = { shots: [] }
  const post = async (name, url) => { await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url }); out.shots.push(name) }
  const at = async (name, a) => {
    const url = await page.evaluate((a) => {
      const g = window.__capy, T = g.THREE
      const c = new T.PerspectiveCamera(34, 1280 / 760, 0.05, 400)
      c.position.set(a[0], a[1], a[2]); c.lookAt(a[3], a[4], a[5]); c.updateMatrixWorld()
      g.renderer.setRenderTarget(null); g.renderer.render(g.scene, c)
      return g.renderer.domElement.toDataURL('image/png')
    }, a)
    await post(name, url)
  }
  const spots = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE
    const rows = []
    const m = new T.Matrix4(), p = new T.Vector3()
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || o.count < 2 || o.count > 8) return
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (p.y > -100) rows.push({ c: o.count, v: o.geometry.attributes.position.count, i, x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) }) }
    })
    return rows
  })
  out.spots = spots.filter(r => (r.c === 5 && r.v === 52) || (r.c === 3 && r.v === 27) || (r.c === 2 && r.v === 180))
  const ll = spots.find(r => r.c === 5 && r.v === 52)
  if (ll) await at('AR4-llama', [ll.x + 3.0, ll.y + 1.2, ll.z + 3.0, ll.x, ll.y + 0.1, ll.z])
  const dg = spots.filter(r => r.c === 2 && r.v === 180 && r.y < 1.5)[0]
  if (dg) await at('AR4-dog', [dg.x + 2.2, dg.y + 0.9, dg.z + 2.2, dg.x, dg.y, dg.z])
  const nk = spots.find(r => r.c === 3 && r.v === 27)
  if (nk) await at('AR4-c3', [nk.x + 3.0, nk.y + 1.0, nk.z + 3.0, nk.x, nk.y - 0.6, nk.z])
  // triangle and mesh budget of the animal, dressed and bare, and of a local
  out.budget = await page.evaluate(() => {
    const g = window.__capy
    const tri = (root) => {
      let t = 0, n = 0
      root.traverse(o => {
        if (!o.isMesh) return
        let v = o.visible, q = o.parent
        while (v && q) { v = q.visible; q = q.parent }
        if (!v) return
        n++
        const geo = o.geometry
        t += geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
      })
      return { meshes: n, tris: Math.round(t) }
    }
    const c = g.capy
    c.wear(null); const bare = tri(c.group)
    c.wear('black-tie'); const tux = tri(c.group)
    c.wear('parka'); const parka = tri(c.group)
    c.wear(null)
    let loc = null
    const L = (g.locals || []).filter(l => l.group)
    if (L.length) loc = tri(L[0].group)
    let inst = []
    g.scene.traverse(o => { if (o.isInstancedMesh && o.count === 13) inst.push({ v: o.geometry.attributes.position.count / 3, count: o.count }) })
    const perPerson = inst.reduce((a, r) => a + r.v, 0)
    return { bare, tux, parka, local: loc, pastoInstancedParts: inst.length, pastoTrisPerPerson: Math.round(perPerson) }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=art-review4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
