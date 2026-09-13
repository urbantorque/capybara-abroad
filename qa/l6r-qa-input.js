async page => {
  await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { keys: [], ui: {}, resize: {}, pretty: null }
  const snap = (label) => page.evaluate((label) => {
    const g = window.__capy
    const p = g.capy.position, v = g.capy.body.velocity, c = g.camera.position
    const nan = [p.x, p.y, p.z, v.x, v.y, v.z, c.x, c.y, c.z].some(x => x !== x)
    return { label, started: g.state.started, paused: !!g.state.paused, biome: g.biome.current, nan,
      lastError: g.state.lastError || null, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)],
      time: +g.state.time.toFixed(1), rung: g.perfAudit().rung }
  }, label)
  out.boot = await snap('boot')
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyQ', 'KeyG', 'KeyF', 'KeyR', 'KeyV', 'KeyX', 'KeyZ',
    'KeyC', 'KeyH', 'KeyL', 'KeyP', 'KeyM', 'KeyN', 'Backquote', 'Slash', 'Enter']
  for (const k of KEYS) {
    await page.keyboard.down(k)
    await page.waitForTimeout(2000)
    await page.keyboard.up(k)
    await page.waitForTimeout(300)
    const s = await snap(k)
    // close anything a key may have opened
    if (k === 'KeyH' || k === 'Slash' || k === 'KeyP') { await page.keyboard.press('Escape'); await page.waitForTimeout(300) }
    if (k === 'KeyM' || k === 'KeyN') { await page.keyboard.press(k); await page.waitForTimeout(200) }
    if (k === 'Backquote') { await page.keyboard.press('Backquote'); await page.waitForTimeout(200) }
    out.keys.push(s)
  }
  // K camera
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1500)
  out.ui.photoOn = await page.evaluate(() => ({ photo: !!document.querySelector('.capyui-photo.show, .capyui-photo:not([hidden])'), cls: document.body.className }))
  await page.screenshot({ path: 'qa/l6r-qa-input-photo.png' })
  await page.keyboard.press('KeyK'); await page.waitForTimeout(800)
  out.ui.afterK = await snap('afterK')
  // J journal
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  out.ui.journalOpen = await snap('journalOpen')
  await page.screenshot({ path: 'qa/l6r-qa-input-journal.png' })
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(800)
  out.ui.journalClosed = await snap('journalClosed')
  // Escape pause
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
  out.ui.pauseOpen = await snap('pauseOpen')
  out.ui.pauseCard = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.capyui-setrow')].map(r => (r.querySelector('.capyui-setname') || {}).textContent)
    const perf = document.querySelector('input[aria-label="performance"]')
    return { rows, perfVal: perf ? perf.value : null, timeBefore: window.__capy.state.time }
  })
  await page.waitForTimeout(2000)
  out.ui.pauseClockHeld = await page.evaluate((t0) => window.__capy.state.time - t0, out.ui.pauseCard.timeBefore)
  await page.screenshot({ path: 'qa/l6r-qa-input-pause.png' })
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  out.ui.pauseClosed = await snap('pauseClosed')
  // resize checks
  const overflow = async (w, h, tag) => {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(2500)
    const r = await page.evaluate(({ w, h }) => {
      const bad = []
      const els = document.querySelectorAll('[class*="capyui"]')
      let n = 0
      for (const el of els) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue
        const b = el.getBoundingClientRect()
        if (b.width === 0 || b.height === 0) continue
        n++
        if (b.left < -1 || b.top < -1 || b.right > w + 1 || b.bottom > h + 1) bad.push({ cls: el.className.toString().slice(0, 50), l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) })
      }
      const doc = document.documentElement
      return { visible: n, bad: bad.slice(0, 12), badN: bad.length, scrollW: doc.scrollWidth, scrollH: doc.scrollHeight,
        canvas: [window.__capy.renderer.domElement.width, window.__capy.renderer.domElement.height], dpr: window.__capy.renderer.getPixelRatio() }
    }, { w, h })
    await page.screenshot({ path: 'qa/l6r-qa-input-' + tag + '.png' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(800)
    const r2 = await page.evaluate(() => {
      const bad = []
      const w = innerWidth, h = innerHeight
      for (const el of document.querySelectorAll('[class*="capyui"]')) {
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue
        const b = el.getBoundingClientRect()
        if (b.width === 0 || b.height === 0) continue
        if (b.left < -1 || b.top < -1 || b.right > w + 1 || b.bottom > h + 1) bad.push({ cls: el.className.toString().slice(0, 50), l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) })
      }
      return { pauseBadN: bad.length, pauseBad: bad.slice(0, 8) }
    })
    await page.screenshot({ path: 'qa/l6r-qa-input-' + tag + '-pause.png' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(500)
    return Object.assign(r, r2)
  }
  out.resize.small = await overflow(800, 500, '800x500')
  out.resize.big = await overflow(1920, 1080, '1920x1080')
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(1500)
  // pin PRETTY (rung 0) through the settings card and measure Sydney at full quality
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  await page.evaluate(() => {
    const perf = document.querySelector('input[aria-label="performance"]')
    if (perf) { perf.value = '1'; perf.dispatchEvent(new Event('input', { bubbles: true })) }
  })
  await page.keyboard.press('Escape'); await page.waitForTimeout(2500)
  out.pretty = await page.evaluate(() => new Promise(res => {
    const g = window.__capy
    const ts = [], calls = [], tris = []
    const f = (t) => { ts.push(t); calls.push(g.state.perf.calls); tris.push(g.state.perf.triangles); if (ts.length < 121) requestAnimationFrame(f); else done() }
    const done = () => {
      const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]); d.sort((a, b) => a - b)
      const q = p => +d[Math.min(d.length - 1, Math.floor(p * d.length))].toFixed(1)
      calls.sort((a, b) => a - b); tris.sort((a, b) => a - b)
      res({ perf: g.perfAudit(), med: q(0.5), p95: q(0.95), calls: calls[calls.length >> 1], tris: tris[tris.length >> 1], biome: g.biome.current })
    }
    requestAnimationFrame(f)
  }))
  out.final = await snap('final')
  await page.evaluate(async (o) => {
    await fetch('/shot?name=l6r-qa-input.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
