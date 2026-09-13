async page => {
  await page.setViewportSize({ width: 1280, height: 760 })
  const log = { runs: [] }
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
      for (const el of document.querySelectorAll('.' + c)) if (vis(el)) {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        out.cards.push({ c, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 300) })
      }
    }
    for (const el of document.querySelectorAll('.capyui-toast')) if (vis(el)) out.toasts.push({ txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200), fs: getComputedStyle(el).fontSize })
    for (const el of document.querySelectorAll('.capynpc-bubble')) if (vis(el)) out.bubbles.push({ txt: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 200), fs: getComputedStyle(el).fontSize })
    let n = 0
    for (const el of document.querySelectorAll('[class*="capyui-"], .capynpc-bubble')) if (el.children.length === 0 && (el.innerText || '').trim() && vis(el)) n++
    out.n = n
    const g = window.__capy
    if (g && g.capy && g.capy.body) { const p = g.capy.body.position; out.pos = [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, Math.round(p.z * 10) / 10] }
    out.biome = g && g.biome && g.biome.current
    return out
  }, ROOTS)
  const keys = async (t) => {
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
  for (const biome of ['venice', 'hanoi']) {
    const run = { biome, samples: [], texts: [], shots: [], lines: [] }
    log.runs.push(run)
    await page.evaluate((b) => { window.__capy.hud.cross(b) }, biome)
    // capture the crossing: the fade + place card
    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(1000)
      const sn = await snap(); sn.t = -9 + i
      run.samples.push(sn)
      if (i === 2 || i === 5) await page.screenshot({ path: 'qa/l6r-writing-' + biome + '-cross' + i + '.png' })
    }
    run.texts.push({ t: 0, txt: await page.evaluate(() => document.body.innerText) })
    await page.screenshot({ path: 'qa/l6r-writing-' + biome + '-000-arrive.png' })
    const seen = new Set(), seenToast = new Set(), seenBub = new Set()
    let shotN = 0
    const t0 = Date.now()
    for (let s = 0; s < 120; s += 2) {
      await keys(s)
      await page.waitForTimeout(2000)
      const t = Math.round((Date.now() - t0) / 1000)
      const sn = await snap(); sn.t = t
      run.samples.push(sn)
      const fresh = []
      for (const c of sn.cards) if (!seen.has(c.c)) { seen.add(c.c); fresh.push(c.c) }
      for (const tt of sn.toasts) if (!seenToast.has(tt.txt)) { seenToast.add(tt.txt); run.lines.push({ t, kind: 'toast', txt: tt.txt, fs: tt.fs }); if (!fresh.length) fresh.push('toast') }
      for (const b of sn.bubbles) if (!seenBub.has(b.txt)) { seenBub.add(b.txt); run.lines.push({ t, kind: 'bubble', txt: b.txt, fs: b.fs }) }
      if (fresh.length && shotN < 14) {
        shotN++
        const name = 'qa/l6r-writing-' + biome + '-' + String(t).padStart(3, '0') + '-' + fresh[0].replace('capyui-', '') + '.png'
        await page.screenshot({ path: name })
        run.shots.push({ t, name, fresh })
      }
      if (s % 10 === 0) run.texts.push({ t, txt: await page.evaluate(() => document.body.innerText) })
    }
    for (const k of ['KeyW', 'KeyA', 'KeyD', 'KeyS', 'ShiftLeft']) await page.keyboard.up(k)
    // the journal, the pause card, the settings
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
    await page.screenshot({ path: 'qa/l6r-writing-' + biome + '-journal.png' })
    run.journal = await page.evaluate(() => { const e = document.querySelector('.capyui-jr'); return e ? e.innerText : '' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(800)
    await page.keyboard.press('Escape'); await page.waitForTimeout(1000)
    await page.screenshot({ path: 'qa/l6r-writing-' + biome + '-pause.png' })
    run.pause = await page.evaluate(() => { const e = document.querySelector('.capyui-pause'); return e ? e.innerText : '' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  }
  await page.evaluate((o) => fetch('/shot?name=l6r-writing-cross.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
