async page => {
  const TAG = 'N1'
  const CH = [['pasto','Digit3'],['kyoto','Digit4'],['cali','Digit5']]
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms)
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await wait(6500)
  await page.keyboard.press('Digit1')
  await wait(5000)
  const rows = []
  for (const [name] of CH) {
    await page.evaluate((name) => {
      const g = window.__capy
      if (g.biome.current !== name) g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }, name)
    await wait(3000)
    // inventory: every npc record with a group, its body, distance from spawn
    const inv = await page.evaluate(() => {
      const g = window.__capy, p = g.capy.body.position
      const out = []
      for (const r of (g.npcs || [])) {
        if (!r || !r.group) continue
        const q = r.group.position
        const wp = new g.THREE.Vector3(); r.group.getWorldPosition(wp)
        out.push({ kind: r.kind || r.type || r.role || '?', name: r.name || r.id || '', x: Math.round(wp.x*10)/10, y: Math.round(wp.y*10)/10, z: Math.round(wp.z*10)/10,
          body: !!r.body, bodyType: r.body ? r.body.type : -1, resp: r.body ? r.body.collisionResponse : null,
          state: r.state || '', d: Math.round(Math.hypot(wp.x - p.x, wp.z - p.z)*10)/10 })
      }
      out.sort((a, b) => a.d - b.d)
      return { biome: g.biome.current, n: out.length, list: out.slice(0, 12) }
    })
    rows.push({ inv })
    // walk into the two nearest that are standing (not the same kind twice if possible)
    const picks = []
    for (const r of inv.list) { if (picks.length < 2 && !picks.some(p => p.kind === r.kind && picks.length === 1 && inv.list.length > 3)) picks.push(r) }
    for (const t of picks) {
      // park 2.4 m from the person, facing them, let the camera settle
      await page.evaluate((t) => {
        const g = window.__capy
        const b = g.capy.body
        const a = Math.random() * Math.PI * 2
        const sx = t.x + Math.sin(a) * 2.4, sz = t.z + Math.cos(a) * 2.4
        const api = g[g.biome.current] || g.env
        const terr = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
        b.position.set(sx, terr(sx, sz) + 0.6, sz); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        if (g.capy.group) g.capy.group.position.copy(b.position)
        if (typeof g.capy.face === 'function') g.capy.face(Math.atan2(t.x - sx, t.z - sz))
      }, t)
      await wait(2400)
      const pre = await page.evaluate((t) => {
        const g = window.__capy
        const yaw = g.input.camYaw
        const wx = -Math.sin(yaw), wz = -Math.cos(yaw)
        // re-place on the camera's line, 2.2 m short of the person's current position
        let px = t.x, pz = t.z
        for (const r of (g.npcs || [])) { if (r && r.group && (r.name || r.id || '') === t.name && (r.kind || r.type || r.role || '?') === t.kind) { const wp = new g.THREE.Vector3(); r.group.getWorldPosition(wp); px = wp.x; pz = wp.z; break } }
        const sx = px - wx * 2.2, sz = pz - wz * 2.2
        const api = g[g.biome.current] || g.env
        const terr = (x, z) => { const v = api && api.terrainHeight ? api.terrainHeight(x, z) : 0; return v === v ? v : 0 }
        const b = g.capy.body
        b.position.set(sx, terr(sx, sz) + 0.6, sz); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        if (g.capy.group) g.capy.group.position.copy(b.position)
        window.__pxN = { sx, sz, wx, wz, px, pz, samples: [] }
        const h = setInterval(() => {
          const p = g.capy.body.position
          let qx = px, qz = pz
          for (const r of (g.npcs || [])) { if (r && r.group && (r.name || r.id || '') === t.name && (r.kind || r.type || r.role || '?') === t.kind) { const wp = new g.THREE.Vector3(); r.group.getWorldPosition(wp); qx = wp.x; qz = wp.z; break } }
          window.__pxN.samples.push([Math.round(((p.x - sx) * wx + (p.z - sz) * wz) * 100) / 100, Math.round(Math.hypot(p.x - qx, p.z - qz) * 100) / 100])
          if (window.__pxN.samples.length > 40) clearInterval(h)
        }, 100)
        return { sx: Math.round(sx*10)/10, sz: Math.round(sz*10)/10, px: Math.round(px*10)/10, pz: Math.round(pz*10)/10 }
      }, t)
      await wait(150)
      await page.keyboard.down('KeyW')
      await wait(1600)
      await page.keyboard.up('KeyW')
      await wait(250)
      const post = await page.evaluate(() => {
        const W = window.__pxN
        let maxAlong = -9, minDist = 99
        for (const s of W.samples) { if (s[0] > maxAlong) maxAlong = s[0]; if (s[1] < minDist) minDist = s[1] }
        const g = window.__capy, p = g.capy.body.position
        return { maxAlong, minDist, along: Math.round(((p.x - W.sx) * W.wx + (p.z - W.sz) * W.wz)*100)/100, ns: W.samples.length, err: g.state.lastError || '' }
      })
      // the person is 2.2 m along; centre-to-centre closer than ~0.55 m means we are inside them
      const verdict = post.minDist < 0.55 ? 'THROUGH' : (post.maxAlong > 3.4 ? 'PAST(sidestep?)' : 'STOPPED')
      rows.push(Object.assign({ c: inv.biome, kind: t.kind, name: t.name, hadBody: t.body, bodyType: t.bodyType, resp: t.resp, state: t.state }, pre, post, { verdict }))
    }
  }
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), { tag: TAG, rows })
  await page.evaluate(s => fetch('/shot?name=px-npc-walk-N1.json', { method: 'POST', body: s }), bl)
}
