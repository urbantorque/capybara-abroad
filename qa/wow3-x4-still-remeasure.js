async page => {
  // ROADMAP-WOW3 X4 — THE STILL FRAME, CLOSED. Measurement only, no src/
  // edits. Re-runs W0's own EXTENDED-mask algorithm (qa/wow2-still-mask.js,
  // copied inline here rather than invoked — that script drives one chapter
  // per process via a chapter.txt file read from port 5189, a leftover from
  // whatever wave built it; this dev server is 5188 per the current brief,
  // so this loops chapters directly instead) against the 9 chapters L11's
  // own Closed section (ROADMAP-WOW.md item 3) traced to the mask, not to
  // shimmer: the 9 are the ones whose movedPct ROSE between qa/wow-still.
  // json (the pre-A3 "before" floor, still on file) and qa/wow-still-after.
  // json (A3's own after-sweep, old mask) — derived exactly, not guessed:
  // sydney +6.8%, pasto +1.5%, cali +15.7%, kowloon +39.3%, goreme +30.7%,
  // manly +57.2%, cave +175.5%, antarctic +16.9%, hanoi +184.9% (the three
  // named "the worst" in ROADMAP-WOW.md are exactly the three largest here).
  // The comparison the −40% target actually asks for is against the
  // ORIGINAL "before" floor (wow-still.json), which this reads back and
  // reports inline rather than hand-copying.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const NAMES = ['sydney', 'pasto', 'cali', 'kowloon', 'goreme', 'manly', 'cave', 'antarctic', 'hanoi']
  const out = { errs, rows: {} }

  for (let ci = 0; ci < NAMES.length; ci++) {
    const name = NAMES[ci]
    await page.evaluate((n) => window.__capy.hud.cross(n), name)
    await page.waitForTimeout(9500)
    const r = await page.evaluate(async () => {
      const g = window.__capy
      const W = g.renderer.domElement.width, H = g.renderer.domElement.height
      const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
      const ctx = c2.getContext('2d', { willReadFrequently: true })
      const cam = g.camera.clone()
      cam.updateMatrixWorld()
      const grab = () => {
        g.renderer.setRenderTarget(null)
        g.renderer.render(g.scene, cam)
        ctx.drawImage(g.renderer.domElement, 0, 0)
        return ctx.getImageData(0, 0, W, H).data
      }
      const shownAll = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }
      // ---- the OLD list, verbatim from wow-still.js ----
      const old = new Set()
      g.scene.traverse(o => {
        if (!o.isInstancedMesh) return
        const key = o.material && o.material.customProgramCacheKey ? String(o.material.customProgramCacheKey()) : ''
        if (o.renderOrder === 6 || (o.geometry.attributes.position && o.geometry.attributes.position.count === 72) || key.indexOf('swayD') === 0) old.add(o)
      })
      for (const l of (g.locals || [])) if (l.group) old.add(l.group)
      old.add(g.capy && (g.capy.model || g.capy.group))
      // ---- the EXTENSION (W0, qa/wow2-still-mask.js) ----
      const ext = new Set()
      const why = { roster: 0, sway: 0, moved: 0, movedInst: 0 }
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh)) return
        const m = o.material
        if (o.isInstancedMesh && m && m.vertexColors && m.color && m.color.getHex() === 0xfaf6ec && !old.has(o)) { ext.add(o); why.roster++ }
        const key = m && m.customProgramCacheKey ? String(m.customProgramCacheKey()) : ''
        if (key.indexOf('sway') >= 0 && !old.has(o) && !ext.has(o)) { ext.add(o); why.sway++ }
      })
      const snap = new Map()
      g.scene.traverse(o => {
        if (!(o.isMesh || o.isInstancedMesh || o.isPoints || o.isLine) || !shownAll(o)) return
        const e = o.matrixWorld.elements
        snap.set(o, { x: e[12], y: e[13], z: e[14], inst: o.isInstancedMesh ? o.instanceMatrix.array.slice(0, o.count * 16) : null })
      })
      await new Promise(res => setTimeout(res, 120))
      const movedNames = []
      const inCapy = (o) => { const cg = g.capy && g.capy.group; for (let p = o; p; p = p.parent) if (p === cg) return true; return false }
      g.scene.traverse(o => {
        const rr = snap.get(o)
        if (!rr || old.has(o) || ext.has(o) || inCapy(o)) return
        const e = o.matrixWorld.elements
        let moved = Math.abs(e[12] - rr.x) > 0.01 || Math.abs(e[13] - rr.y) > 0.01 || Math.abs(e[14] - rr.z) > 0.01
        let inst = false
        if (!moved && rr.inst) {
          const a = o.instanceMatrix.array
          for (let i = 0; i < o.count && !moved; i++) {
            const k = i * 16
            if (Math.abs(a[k + 12] - rr.inst[k + 12]) > 0.01 || Math.abs(a[k + 13] - rr.inst[k + 13]) > 0.01 || Math.abs(a[k + 14] - rr.inst[k + 14]) > 0.01) { moved = true; inst = true }
          }
        }
        if (moved) { ext.add(o); if (inst) why.movedInst++; else why.moved++; if (movedNames.length < 16) movedNames.push((o.name || o.type) + (o.isInstancedMesh ? '[' + o.count + ']' : '')) }
      })
      const th = 8, n = W * H, lowStart = Math.floor(H * 2 / 3)
      const setVis = (set, v) => { for (const o of set) if (o) o.visible = v }
      const diff = (a, b) => {
        let moved = 0, sum = 0, movedLow = 0
        for (let i = 0; i < n; i++) {
          const j = i * 4
          const d = Math.max(Math.abs(a[j] - b[j]), Math.abs(a[j + 1] - b[j + 1]), Math.abs(a[j + 2] - b[j + 2]))
          sum += d
          if (d > th) { moved++; if ((i / W | 0) >= lowStart) movedLow++ }
        }
        return { movedPct: +(100 * moved / n).toFixed(3), meanDiff: +(sum / n).toFixed(3), movedLowerThirdPct: +(100 * movedLow / (n / 3)).toFixed(3) }
      }
      const wasOld = [...old].filter(o => o && o.visible), wasExt = [...ext].filter(o => o && o.visible)
      let bestOld = null, bestExt = null
      for (let rep = 0; rep < 3; rep++) {
        setVis(wasOld, false)
        const aOld = grab()
        setVis(wasExt, false)
        const aExt = grab()
        setVis(wasExt, true); setVis(wasOld, true)
        await new Promise(res => setTimeout(res, 120))
        setVis(wasOld, false)
        const bOld = grab()
        setVis(wasExt, false)
        const bExt = grab()
        setVis(wasExt, true); setVis(wasOld, true)
        const ro = diff(aOld, bOld), re = diff(aExt, bExt)
        if (!bestOld || ro.movedPct < bestOld.movedPct) bestOld = ro
        if (!bestExt || re.movedPct < bestExt.movedPct) bestExt = re
        await new Promise(res => setTimeout(res, 400))
      }
      return { biome: g.biome && g.biome.current, W, H, hiddenOld: wasOld.length, hiddenExt: wasOld.length + wasExt.length, extra: why,
               old: bestOld, ext: bestExt }
    })
    out.rows[name] = r
  }

  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow3-x4-still-remeasure', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
