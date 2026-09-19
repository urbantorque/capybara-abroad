async page => {
  await page.evaluate((n) => window.__capy.hud.cross(n), 'sahara')
  await page.waitForTimeout(9500)
  const out = await page.evaluate(() => {
    const g = window.__capy, T = g.THREE, A = window.__art
    const body = A.byName('sahPeople'), head = A.byName('sahPeopleHeads')
    const r = A.nearest('sahPeople', true)
    const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3()
    head.getMatrixAt(r.i, m); m.decompose(p, q, s)
    const res = { i: r.i, body: r, head: { x: p.x, y: p.y, z: p.z, sy: s.y }, count: { b: body.count, h: head.count } }
    // what else stands within 0.6 m of this person
    const others = []
    g.scene.traverse(o => {
      if (o === body) return
      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m); m.decompose(p, q, s)
          if (Math.abs(p.x - r.x) < 0.6 && Math.abs(p.z - r.z) < 0.6) others.push({ name: o.name || '(unnamed IM)', i, y: +p.y.toFixed(2), sy: +s.y.toFixed(2), verts: o.geometry.attributes.position.count })
        }
      } else if (o.isMesh) {
        o.getWorldPosition(p)
        if (Math.abs(p.x - r.x) < 0.6 && Math.abs(p.z - r.z) < 0.6) others.push({ name: o.name || '(mesh)', parent: o.parent && o.parent.name, y: +p.y.toFixed(2), verts: o.geometry.attributes.position.count })
      }
    })
    res.others = others
    return res
  })
  const shots = {}
  const post = async (name, url) => { await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url }) }
  // variant renders: all, no body pool, no head pool
  for (const v of ['all', 'nobody', 'nohead']) {
    const url = await page.evaluate((v) => {
      const A = window.__art
      const b = A.byName('sahPeople'), h = A.byName('sahPeopleHeads')
      b.visible = v !== 'nobody'; h.visible = v !== 'nohead'
      const r = A.nearest('sahPeople', true)
      const u = A.personShot(r, 2.4, 0.2, 34, 0.0)
      b.visible = true; h.visible = true
      return u
    }, v)
    await post('WOW2-probe-' + v, url)
  }
  await page.evaluate(async (o) => {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    await fetch('/shot?name=WOW2-people-probe.json', { method: 'POST', body: b64 })
  }, out)
}
