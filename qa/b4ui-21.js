async page => {
  const out = {}
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(500)
  // clean Escape-in-photo repro
  let on = await page.evaluate(() => window.__capy.hud.photoAudit().on)
  if (on) { await page.keyboard.press('KeyK'); await page.waitForTimeout(900) }
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1200)
  out.photoOn = await page.evaluate(() => window.__capy.hud.photoAudit().on)
  await page.keyboard.press('Escape'); await page.waitForTimeout(1000)
  out.afterEsc = await page.evaluate(() => ({ photo: window.__capy.hud.photoAudit().on,
    jr: document.querySelector('.capyui-jr').classList.contains('show') }))
  await page.keyboard.press('Escape'); await page.waitForTimeout(700)
  await page.keyboard.press('KeyK'); await page.waitForTimeout(700)
  // cave, camera up, contrast of everything that sits over the world
  await page.evaluate(() => { window.__capy.biome.switchTo('cave') })
  await page.waitForTimeout(9000)
  await page.keyboard.press('KeyK'); await page.waitForTimeout(1400)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  out.camUp = await page.evaluate(() => window.__capy.hud.photoAudit().on)
  out.contrast = await page.evaluate(() => {
    const parse = s => { const m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null }
    const over = (fg, bg) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i])
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    const bgOf = el => { let p = el
      while (p && p.nodeType === 1) { const c = parse(getComputedStyle(p).backgroundColor); if (c && c[3] >= 0.999) return [c[0], c[1], c[2]]; p = p.parentElement }
      return null }
    const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
    const res = []; const seen = new Set()
    document.querySelectorAll('.capyui *').forEach(el => {
      if (el.children.length) return
      const t = (el.textContent || '').trim(); if (t.length < 3) return
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return
      let p = el, op = 1, ok = true
      while (p && p.nodeType === 1) { const c = getComputedStyle(p); op *= +c.opacity; if (c.display === 'none' || c.visibility === 'hidden') ok = false
        if (p.tagName === 'DETAILS' && !p.open && p !== el) ok = false
        p = p.parentElement }
      if (!ok || op < 0.05) return
      const b = el.getBoundingClientRect(); if (b.width < 2 || b.height < 2) return
      const k = cls(el); if (seen.has(k)) return; seen.add(k)
      const bg = bgOf(el); if (!bg) { res.push({ c: k, r: 'NO-OPAQUE-BG', px: +parseFloat(cs.fontSize).toFixed(1), t: t.slice(0, 30) }); return }
      const fg = parse(cs.color)
      const fgc = over([fg[0], fg[1], fg[2], fg[3] * op], bg)
      const la = L(fgc), lb = L(bg)
      const r = +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))).toFixed(2)
      const fs = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700
      const need = (fs >= 24 || (fs >= 18.66 && bold)) ? 3 : 4.5
      res.push({ c: k, r, need, px: +fs.toFixed(1), op: +op.toFixed(2), t: t.slice(0, 30) })
    })
    return res
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-21.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
