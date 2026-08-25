async page => {
  const errs = []
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { issues: [] }
    g.biome.switchTo('pantanal')
    const sp = g.biome.spawnOf('pantanal'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const api = g.pantanal

    // ---- the surface ladder now names the chapter's own grounds ----------
    const P = (x, z) => api.surfacePitch ? +api.surfacePitch(x, z, 1).toFixed(2) : null
    R.surf = {
      campo: P(0, 20), road: P(api.landing ? api.landing.x : 0, 0),
      sandbar: null, fazenda: null
    }
    // ask the zones themselves
    if (api.inZone) {
      // walk a grid and record the distinct pitches, and where each comes from
      const seen = {}
      for (let x = -120; x <= 120; x += 6) {
        for (let z = -120; z <= 100; z += 6) {
          if (api.isOverWater && api.isOverWater(x, z)) continue
          const v = P(x, z)
          if (v == null) continue
          seen[v] = (seen[v] || 0) + 1
        }
      }
      R.pitchHistogram = seen
      // spot checks
      const zoneAt = (n) => {
        for (let x = -120; x <= 120; x += 3)
          for (let z = -120; z <= 100; z += 3)
            if (api.inZone(n, x, z) && !(api.isOverWater && api.isOverWater(x, z)))
              return [x, z, P(x, z)]
        return null
      }
      R.sandbar = zoneAt('sandbar')
      R.fazenda = zoneAt('fazenda')
    }

    // ---- the shadow pass -------------------------------------------------
    let tris = 0, shadow = 0
    g.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return
      for (let p = o; p; p = p.parent) if (!p.visible) return
      const gm = o.geometry; if (!gm) return
      const t = (gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3) *
                (o.isInstancedMesh ? o.count : 1)
      tris += t; if (o.castShadow) shadow += t
    })
    R.tris = Math.round(tris); R.shadowTris = Math.round(shadow)

    // ---- the props now have owners ---------------------------------------
    const props = (g.physics && g.physics.list) ? g.physics.list() : null
    R.propApi = !!props
    R.err = g.state.lastError || null
    return R
  })
  out.pageErrors = errs
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-panfix.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
