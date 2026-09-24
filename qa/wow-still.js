async page => {
  // ROADMAP-WOW A3 — THE SHIMMER FLOOR. Two raw renders at rest, ~120 ms
  // apart, through ONE frozen copy of the resting camera, with the intended
  // motion masked out for both: the weather fields (renderOrder 6), the
  // instanced roster (72-vertex figures), any sway-hooked instanced foliage
  // (customProgramCacheKey 'swayD…'), the hand-built locals and the animal.
  // What still moves is the floor: thin things, thresholded specks, shadow
  // texels. Per-pixel, never a frame mean.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  // Begin, by its button (ROADMAP-TEN T1a). Digit1 here started FREE ROAM
  // Sydney, because a digit on the title's front was a tile press; the
  // shimmer floor is the story's frame, and page one's only digit is now
  // Begin anyway. The button says so without depending on that.
  await page.evaluate(() => [...document.querySelectorAll('.capyui-go')].find(b => !b.classList.contains('alt')).click())
  await page.waitForTimeout(9000)
  const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice',
                 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  const out = { errs, rows: {}, thresh: 8 }
  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    if (ci > 0) {
      await page.evaluate((n) => window.__capy.hud.cross(n), name)
      await page.waitForTimeout(9500)
    }
    const r = await page.evaluate(async () => {
      const g = window.__capy, T = g.THREE
      const hidden = []
      const hide = o => { if (o && o.visible !== false) { hidden.push(o); o.visible = false } }
      g.scene.traverse(o => {
        if (!o.isInstancedMesh) return
        const key = o.material && o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()) : ''
        if (o.renderOrder === 6 || (o.geometry.attributes.position && o.geometry.attributes.position.count === 72) || key.indexOf('swayD') === 0) hide(o)
      })
      for (const l of (g.locals || [])) if (l.group) hide(l.group)
      hide(g.capy && (g.capy.model || g.capy.group))
      const cam = g.camera.clone()
      cam.updateMatrixWorld()
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const grab = () => {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam)
        ctx.drawImage(g.renderer.domElement, 0, 0)
        return ctx.getImageData(0, 0, W, H).data
      }
      // three pairs, the floor is the LEAST moved of them: a shower's onset
      // or a lightning frame is an event, not the floor.
      const th = 8
      const n = W * H
      const lowStart = Math.floor(H * 2 / 3)
      let best = null
      for (let rep = 0; rep < 3; rep++) {
        const a = grab()
        await new Promise(res => setTimeout(res, 120))
        const b = grab()
        let moved = 0, sum = 0, movedLow = 0
        for (let i = 0; i < n; i++) {
          const j = i * 4
          const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
          sum += d
          if (d > th) { moved++; if ((i / W | 0) >= lowStart) movedLow++ }
        }
        const row = { movedPct: +(100 * moved / n).toFixed(3), meanDiff: +(sum / n).toFixed(3), movedLowerThirdPct: +(100 * movedLow / (n / 3)).toFixed(3) }
        if (!best || row.movedPct < best.movedPct) best = row
        await new Promise(res => setTimeout(res, 400))
      }
      for (const o of hidden) o.visible = true
      return Object.assign({ biome: g.biome && g.biome.current, hidden: hidden.length, W, H }, best)
    })
    out.rows[name] = r
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow-still.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
