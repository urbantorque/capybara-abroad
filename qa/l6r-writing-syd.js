async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.screenshot({ path: 'qa/l6r-writing-syd-000-title.png' })
  const log = { samples: [], texts: [], shots: [], bubbles: [] }
  log.texts.push({ t: 0, where: 'title', txt: await page.evaluate(() => document.body.innerText) })
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const started = await page.evaluate(() => !!(window.__capy && window.__capy.state && window.__capy.state.started))
  log.started = started
  const ROOTS = ['capyui-title', 'capyui-todo', 'capyui-marq', 'capyui-rec', 'capyui-place', 'capyui-moment', 'capyui-keep', 'capyui-done', 'capyui-fade', 'capyui-jr', 'capyui-led', 'capyui-alb', 'capyui-photo', 'capyui-pause', 'capyui-map', 'capyui-fly', 'capyui-stam', 'capyui-pips', 'capyui-legend', 'capyui-therm', 'capyui-zone', 'capyui-over', 'capyui-shelf', 'capyui-base', 'capyui-home', 'capyui-tab', 'capyui-touch', 'capyui-picks']
  const snap = async () => page.evaluate((roots) => {
    const vis = (el) => {
      if (!el) return false
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return false
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return false
      return true
    }
    const out = { cards: [], toasts: [], bubbles: [], n: 0 }
    for (const c of roots) {
      const els = document.querySelectorAll('.' + c)
      for (const el of els) if (vis(el)) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        out.cards.push({ c, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 260) })
      }
    }
    for (const el of document.querySelectorAll('.capyui-toast')) if (vis(el)) {
      const cs = getComputedStyle(el)
      out.toasts.push({ txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200), fs: cs.fontSize, color: cs.color, bg: cs.backgroundColor })
    }
    for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) {
      const cs = getComputedStyle(el)
      out.bubbles.push({ txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200), fs: cs.fontSize })
    }
    // count of visible text-bearing elements in the HUD at once
    let n = 0
    for (const el of document.querySelectorAll('[class*="capyui-"], .capynpc-bubble')) {
      if (el.children.length === 0 && (el.innerText || '').trim() && vis(el)) n++
    }
    out.n = n
    const g = window.__capy
    if (g && g.capy && g.capy.body) { const p = g.capy.body.position; out.pos = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10] }
    out.biome = g && g.biome && g.biome.current
    out.done = g && g.taskDone ? null : null
    return out
  }, ROOTS)
  const seen = new Set()
  const seenToast = new Set(), seenBub = new Set()
  let shotN = 0
  const t0 = Date.now()
  const keys = async (t) => {
    // a naive but purposeful drive: forward with turns, a sprint burst, a hop, a wheek, a grab
    const phase = Math.floor(t / 2) % 12
    const kb = page.keyboard
    await kb.up('KeyA'); await kb.up('KeyD'); await kb.up('ShiftLeft'); await kb.up('KeyS')
    if (phase < 9) await kb.down('KeyW'); else await kb.up('KeyW')
    if (phase === 2 || phase === 6) await kb.down('KeyA')
    if (phase === 4 || phase === 8) await kb.down('KeyD')
    if (phase === 3 || phase === 7) await kb.down('ShiftLeft')
    if (phase === 5) { await kb.press('Space') }
    if (phase === 9) { await kb.press('KeyQ') }
    if (phase === 10) { await kb.press('KeyE') }
    if (phase === 11) { await kb.down('KeyS') }
  }
  const total = 180
  for (let s = 0; s < total; s += 2) {
    await keys(s)
    await page.waitForTimeout(2000)
    const t = Math.round((Date.now() - t0) / 1000)
    const sn = await snap()
    sn.t = t
    log.samples.push(sn)
    let fresh = []
    for (const c of sn.cards) {
      const k = c.c + '|' + (c.c === 'capyui-todo' ? '' : c.txt.slice(0, 40))
      if (!seen.has(c.c)) { seen.add(c.c); fresh.push(c.c) }
      void k
    }
    for (const tt of sn.toasts) if (!seenToast.has(tt.txt)) { seenToast.add(tt.txt); log.bubbles.push({ t, kind: 'toast', txt: tt.txt, fs: tt.fs }); if (fresh.length === 0 && shotN < 40) fresh.push('toast') }
    for (const b of sn.bubbles) if (!seenBub.has(b.txt)) { seenBub.add(b.txt); log.bubbles.push({ t, kind: 'bubble', txt: b.txt, fs: b.fs }) }
    if (fresh.length && shotN < 40) {
      shotN++
      const name = 'qa/l6r-writing-syd-' + String(t).padStart(3, '0') + '-' + fresh[0].replace('capyui-', '') + '.png'
      await page.screenshot({ path: name })
      log.shots.push({ t, name, fresh })
    }
    if (s % 10 === 0) log.texts.push({ t, txt: await page.evaluate(() => document.body.innerText) })
  }
  for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'ShiftLeft']) await page.keyboard.up(k)
  await page.screenshot({ path: 'qa/l6r-writing-syd-end.png' })
  await page.evaluate((o) => fetch('/shot?name=l6r-writing-syd.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
