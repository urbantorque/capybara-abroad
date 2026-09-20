async page => {
  // ROADMAP-WOW2 W0 — THE STILL MASK, EXTENDED. A copy of qa/wow-still.js
  // (untouched) that measures the shimmer floor twice in the same window:
  // once under the OLD mask (weather fields at renderOrder 6, the 72-vertex
  // roster torso, 'swayD' grass, the locals, the animal) and once under the
  // EXTENDED mask, which adds
  //   - the whole roster by material (npc.js instMat: vertexColors over
  //     PALETTE.sail; the old key hid the torso and left heads, limbs, hats),
  //   - every sway-hooked material ('sway<k>', usually prefixed 'leaf1|' —
  //     the old test indexOf('swayD') === 0 matched grass.js alone),
  //   - and, generically, ANY renderable whose world translation, or any of
  //     whose instances, moved > 1 cm across a 120 ms wait: traffic, ferries,
  //     a herd, birds, a chapter's own crowd — the L11 closeout's open item
  //     (Hanoi's diff image was its traffic).
  // One chapter per invocation, read off qa/wow2-chapter.txt like the
  // motion sheet. The least of three pairs, as the original.
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  let chapter = ''
  try { chapter = (await (await page.request.get('http://localhost:5189/qa/wow2-chapter.txt')).text()).trim() } catch (e) {}
  if (!/^[a-z]+$/.test(chapter)) chapter = 'sydney'
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state && window.__capy.state.started)).catch(() => false)
  if (!started) {
    await page.setViewportSize({ width: 1280, height: 760 })
    await page.goto('http://localhost:5189/')
    await page.waitForTimeout(5200)
    await page.evaluate(() => { try { localStorage.clear() } catch (e) {} ; document.querySelector('.capyui-go').click() })
    await page.waitForTimeout(3000)
  }
  const live = await page.evaluate(() => window.__capy.biome.current)
  if (live !== chapter) {
    await page.evaluate((n) => window.__capy.hud.cross(n), chapter)
    await page.waitForTimeout(9500)
  }
  const r = await page.evaluate(async () => {
    const g = window.__capy, T = g.THREE
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
    // ---- the EXTENSION ----
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
      const r = snap.get(o)
      if (!r || old.has(o) || ext.has(o) || inCapy(o)) return
      const e = o.matrixWorld.elements
      let moved = Math.abs(e[12] - r.x) > 0.01 || Math.abs(e[13] - r.y) > 0.01 || Math.abs(e[14] - r.z) > 0.01
      let inst = false
      if (!moved && r.inst) {
        const a = o.instanceMatrix.array
        for (let i = 0; i < o.count && !moved; i++) {
          const k = i * 16
          if (Math.abs(a[k + 12] - r.inst[k + 12]) > 0.01 || Math.abs(a[k + 13] - r.inst[k + 13]) > 0.01 || Math.abs(a[k + 14] - r.inst[k + 14]) > 0.01) { moved = true; inst = true }
        }
      }
      if (moved) { ext.add(o); if (inst) why.movedInst++; else why.moved++; if (movedNames.length < 16) movedNames.push((o.name || o.type) + (o.isInstancedMesh ? '[' + o.count + ']' : '')) }
    })
    // ---- three pairs, both masks in the same 120 ms window ----
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
      return { movedPct: +(100 * moved / n).toFixed(3), movedPx: moved, meanDiff: +(sum / n).toFixed(3), movedLowerThirdPct: +(100 * movedLow / (n / 3)).toFixed(3) }
    }
    // an object may be in both sets' way: remember what was visible before
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
    return { biome: g.biome && g.biome.current, W, H, hiddenOld: wasOld.length, hiddenExt: wasOld.length + wasExt.length, extra: why, extraNames: movedNames,
             old: bestOld, ext: bestExt }
  })
  const out = { chapter, errs, result: r }
  await page.evaluate(async (o) => { await fetch('/shot?name=wow2-still-mask-' + o.chapter + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, out)
}
