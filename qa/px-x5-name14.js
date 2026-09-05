// NAME THE FOURTEEN. px-x5-rerank.js reduced the 4 Sep audit's 99 non-vegetation
// samples to fourteen faces that behave like walls at ankle, chest and head with
// a near-vertical normal. A list of coordinates is raw probe output, which is the
// exact criticism X9 levelled at the camera audit, so this names each one: the
// hit object's ancestor chain, geometry, colour and world bounding box.
async page => {
  const out = { errs: [], rows: [] }
  page.on('pageerror', e => out.errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(6500)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(3000)
  const byCh = {"pasto":[{"ch":"pasto","x":-23,"z":40,"ux":1,"uz":0},{"ch":"pasto","x":20,"z":40,"ux":1,"uz":0}],"kyoto":[{"ch":"kyoto","x":-37,"z":20,"ux":0,"uz":-1},{"ch":"kyoto","x":-32,"z":20,"ux":0,"uz":-1}],"cali":[{"ch":"cali","x":67,"z":-30,"ux":1,"uz":0},{"ch":"cali","x":-12,"z":-5,"ux":1,"uz":0},{"ch":"cali","x":-12,"z":5,"ux":1,"uz":0},{"ch":"cali","x":-61,"z":20,"ux":0,"uz":1},{"ch":"cali","x":72,"z":20,"ux":0,"uz":1}],"drift":[{"ch":"drift","x":-38,"z":-110,"ux":1,"uz":0},{"ch":"drift","x":-37,"z":-110,"ux":-1,"uz":0}],"palawan":[{"ch":"palawan","x":-48,"z":40,"ux":0,"uz":-1}],"goreme":[{"ch":"goreme","x":-37,"z":20,"ux":1,"uz":0}],"cave":[{"ch":"cave","x":-17,"z":-200,"ux":1,"uz":0}]}
  const RUN = (list) => {
    const g = window.__capy, THREE = g.THREE, b = g.capy.body
    const nm = g.biome.current, inp = g.input
    const T = k => { for (let i = 0; i < k; i++) { inp.x = 0; inp.z = 0; inp.run = false; inp.camYaw = 0; inp.jump = false; inp.jumpPressed = false; g.tick(1 / 60, false) } }
    const api = nm === 'sydney' ? g.env : g[nm]
    const th = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
    const WATER = /water|sea|river|lake|canal|pool|surf|swell|harbour|lagoon|ocean|tide|wave|foam|wake|marsh|spring/i
    const rows = []
    for (const s of list) {
      const t = th(s.x, s.z)
      b.position.set(s.x, Math.max(t, 0) + 3.0, s.z)
      b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
      let st = 0
      for (let i = 0; i < 180; i++) { T(1); if (Math.abs(b.velocity.y) < 0.05) { if (++st > 12) break } else st = 0 }
      const P = b.position
      const ray = new THREE.Raycaster(); ray.far = 4.0
      ray.set(new THREE.Vector3(P.x, P.y, P.z), new THREE.Vector3(s.ux, 0, s.uz).normalize())
      const roots = g.scene.children.filter(c => c.visible && c !== g.capy.group)
      let hit = null
      for (const h of ray.intersectObjects(roots, true)) {
        let o = h.object, ok = true, chain = []
        while (o) { if (!o.visible || (o.name && WATER.test(o.name))) { ok = false; break } chain.push(o.name || o.type); o = o.parent }
        if (!ok) continue
        const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material
        if (m && m.transparent && m.opacity < 0.6) continue
        const bb = new THREE.Box3().setFromObject(h.object)
        hit = { d: +h.distance.toFixed(2), chain: chain.slice(0, 5).join(' < '),
                geo: h.object.geometry ? h.object.geometry.type : '?',
                inst: !!h.object.isInstancedMesh, count: h.object.count || 0,
                col: (m && m.color) ? '#' + m.color.getHexString() : '?',
                bb: [+bb.min.x.toFixed(1), +bb.min.y.toFixed(1), +bb.min.z.toFixed(1),
                     +bb.max.x.toFixed(1), +bb.max.y.toFixed(1), +bb.max.z.toFixed(1)],
                size: [+(bb.max.x-bb.min.x).toFixed(1), +(bb.max.y-bb.min.y).toFixed(1), +(bb.max.z-bb.min.z).toFixed(1)] }
        break
      }
      rows.push({ nm, at: [s.x, s.z], dir: [s.ux, s.uz], y: +P.y.toFixed(2), hit })
    }
    return rows
  }
  for (const ch of Object.keys(byCh)) {
    try {
      await page.evaluate((n) => { const g = window.__capy; if (!g.biome.isActive(n)) g.biome.switchTo(n) }, ch)
      await page.waitForTimeout(3600)
      const seen = await page.evaluate(() => window.__capy.biome.current)
      if (seen !== ch) { out.errs.push('BIOME MISMATCH ' + ch + ' got ' + seen); continue }
      out.rows = out.rows.concat(await page.evaluate(RUN, byCh[ch]))
    } catch (e) { out.errs.push(ch + ': ' + String(e).slice(0, 160)) }
  }
  await page.evaluate(o => fetch('/shot?name=px-x5-name14.json', {
    method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1))))
  }), out)
}
