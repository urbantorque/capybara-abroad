async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })

  const TAG = 'a2'
  const out = { tag: TAG, shots: [], errs: [] }

  // chapter key -> what we want a face of
  const JOBS = [
    ['sydney',  'Digit1', 'crowd'],   // the instanced roster
    ['venice',  'Digit0', 'local'],   // a talking local
    ['marrakech', 'Digit8', 'local'],
  ]

  for (const [name, key, kind] of JOBS) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(6000)
    const r = await page.evaluate(async (a) => {
      const [name, kind] = a
      const g = window.__capy
      const T = g.THREE
      // pick a subject IN THIS CHAPTER. A local carries its biome; a roster
      // person only exists in Sydney at all.
      let head = null, who = null
      if (kind === 'local') {
        const L = (g.locals || []).filter(l => l.biome === g.biome.current && l.fig)
        if (!L.length) return { name: name, none: true, biome: g.biome.current,
                                nLocals: (g.locals || []).length }
        who = L[0]
        head = who.fig.head
      } else {
        const N = (g.npcs || []).filter(n => n.kind !== 'ibis' && n.nodes && n.nodes.head)
        if (!N.length) return { name: name, none: true, biome: g.biome.current }
        who = N[0]
        head = who.nodes.head
      }
      // stand the capybara in front of them so anything that reacts, reacts
      const wp = new T.Vector3()
      head.getWorldPosition(wp)
      const yaw = (who.group ? who.group.rotation.y : 0) + (who.yaw || 0)
      const fx = Math.sin(yaw), fz = Math.cos(yaw)
      let gy = wp.y - 1.5
      try { const api = g[g.biome.current]; if (api && api.terrainHeight) gy = api.terrainHeight(wp.x + fx * 2.2, wp.z + fz * 2.2) } catch (e) {}
      g.capy.body.position.set(wp.x + fx * 2.2, gy + 0.6, wp.z + fz * 2.2)
      g.capy.body.velocity.set(0, 0, 0)
      await new Promise(r => setTimeout(r, 2600))
      head.getWorldPosition(wp)
      // the temp camera: 1.1 m out along the person's own facing, at eye level
      const cam = new T.PerspectiveCamera(34, 1, 0.05, 400)
      const cx = g.capy.position.x - wp.x, cz = g.capy.position.z - wp.z
      const cl = Math.max(0.001, Math.hypot(cx, cz))
      cam.position.set(wp.x + (cx / cl) * 1.9, wp.y + 0.16, wp.z + (cz / cl) * 1.9)
      cam.lookAt(wp.x, wp.y + 0.02, wp.z)
      g.renderer.setRenderTarget(null)
      g.renderer.render(g.scene, cam)
      const url = g.renderer.domElement.toDataURL('image/png')
      return { name: name, biome: g.biome.current, url: url,
               at: [Math.round(wp.x), Math.round(wp.z)],
               kind: kind, id: who.id || null }
    }, [name, kind])
    if (r.url) {
      await page.evaluate(async (o) => {
        await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u })
      }, { n: 'p5-' + TAG + '-' + name, u: r.url })
      delete r.url
    }
    out.shots.push(r)
  }
  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-face-' + o.tag + '.json', { method: 'POST', body: s })
  }, out)
}
