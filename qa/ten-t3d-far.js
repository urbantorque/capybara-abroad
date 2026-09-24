async page => {
  // T3d, noKyoFar: the bowl. (1) The resting arrival lens down the Gion lane, composited,
  // live then cut (page.screenshot). (2) Five pinned lenses drawn through the composite
  // (game.post), live and cut in one evaluate: down the Gion lane east (the pagoda's axis), west from the zen garden,
  // north-east from the pond, south from the Uji town, and east-south-east from the Uji bridge (the river's way out,
  // which must stay open). For each, the share of pixels the far layer changed in the top
  // half (hide-and-diff), and the audit. prefs pf 1 pins the governor at rung 0.
  const CH = 'kyoto', NAME = 'ten-t3d-far'
  const out = { errs: [] }
  page.on('pageerror', e => out.errs.push('pageerror: ' + String(e.message || e)))
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5194/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(6000)
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === CH) break
    await page.evaluate(n => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross(n) }, CH)
    await page.waitForTimeout(11000)
  }
  // the travel card has to be gone before the resting lens is a picture of anything
  for (let i = 0; i < 20; i++) {
    if (await page.evaluate(() => { const g = window.__capy; return g.biome.current === 'kyoto' && !(g.state.travelling || g.state.crossing) })) break
    await page.waitForTimeout(1000)
  }
  await page.waitForTimeout(8000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.rung = await page.evaluate(() => window.__capy.state.perfRung)
  out.audit = await page.evaluate(() => window.__capy.kyoto.farAudit())
  out.fog = await page.evaluate(() => { const f = window.__capy.scene.fog; return f ? [+f.near.toFixed(1), +f.far.toFixed(1)] : null })
  await page.screenshot({ path: 'qa/' + NAME + '-rest-live.png' })
  await page.evaluate(() => { window.__capy.state.noKyoFar = true })
  await page.waitForTimeout(500)
  out.auditCut = await page.evaluate(() => window.__capy.kyoto.farAudit())
  await page.screenshot({ path: 'qa/' + NAME + '-rest-cut.png' })
  await page.evaluate(() => { window.__capy.state.noKyoFar = false })
  await page.waitForTimeout(500)
  out.auditBack = await page.evaluate(() => window.__capy.kyoto.farAudit())

  const LENS = {
    gion: { cam: [-16, 4.0, 52], look: [80, 5.0, 52] },
    west: { cam: [-30, 4.0, 20], look: [-120, 4.0, 30] },
    north: { cam: [40, 4.0, -20], look: [100, 12, -290] },
    south: { cam: [24, 4.0, 176], look: [0, 4.0, 330] },
    ujiOut: { cam: [4, 4.0, 128], look: [120, 2.0, 170] },
  }
  for (const ln of Object.keys(LENS)) {
    out[ln] = await page.evaluate(async o => {
      const g = window.__capy, THREE = g.THREE, K = g.kyoto, L = o.L
      const grab = cut => {
        g.state.noKyoFar = cut
        g.tick(1 / 60, false)
        g.renderer.setSize(1280, 760, false)
        g.camera.aspect = 1280 / 760; g.camera.updateProjectionMatrix()
        g.camera.position.set(L.cam[0], K.terrainHeight(L.cam[0], L.cam[2]) + L.cam[1], L.cam[2])
        g.camera.lookAt(new THREE.Vector3(L.look[0], L.look[1], L.look[2]))
        g.camera.updateMatrixWorld(true)
        g.post.render()
        const c = g.renderer.domElement, t = document.createElement('canvas')
        t.width = c.width; t.height = c.height
        t.getContext('2d').drawImage(c, 0, 0)
        return { url: c.toDataURL('image/png'), d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height }
      }
      const A = grab(false), B = grab(true)
      g.state.noKyoFar = false
      let n = 0, top = 0, sum = 0
      for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        const i = (y * A.w + x) * 4
        const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
        if (dd > 6) { n++; sum += dd; if (y < A.h * 0.5) top++ }
      }
      await fetch('/shot?name=' + o.name + '-live', { method: 'POST', body: A.url.split(',')[1] })
      await fetch('/shot?name=' + o.name + '-cut', { method: 'POST', body: B.url.split(',')[1] })
      return { changed: +(n / (A.w * A.h)).toFixed(4), changedTop: +(top / (A.w * A.h * 0.5)).toFixed(4), meanDelta: n ? +(sum / n).toFixed(1) : 0 }
    }, { L: LENS[ln], name: NAME + '-' + ln })
  }
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
