async page => {
  const SCAN = () => {
  const W = innerWidth, H = innerHeight
  const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
  const vis = el => {
    let p = el
    while (p && p.nodeType === 1) {
      const cs = getComputedStyle(p)
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false
      if (p.hasAttribute && p.hasAttribute('hidden')) return false
      p = p.parentElement
    }
    return true
  }
  // the effective clip box: intersect every ancestor that is not overflow:visible
  const clipBox = el => {
    let l = 0, t = 0, r = W, b = H
    let p = el.parentElement
    while (p && p.nodeType === 1) {
      const cs = getComputedStyle(p)
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const q = p.getBoundingClientRect()
        if (cs.overflowX !== 'visible') { l = Math.max(l, q.left); r = Math.min(r, q.right) }
        if (cs.overflowY !== 'visible') { t = Math.max(t, q.top); b = Math.min(b, q.bottom) }
      }
      p = p.parentElement
    }
    return { l, t, r, b }
  }
  const scrollers = el => {
    const out = []
    let p = el.parentElement
    while (p && p.nodeType === 1) {
      const cs = getComputedStyle(p)
      if ((/auto|scroll/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 2) ||
          (/auto|scroll/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 2)) out.push(p)
      p = p.parentElement
    }
    return out
  }
  // text leaves only: decorative bleed (glow, marks, grain) carries no text
  const ownText = el => {
    let s = ''
    for (const n of el.childNodes) if (n.nodeType === 3) s += n.nodeValue
    return s.trim()
  }
  const INTER = 'button,a[href],summary,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])'
  const cands = []
  document.querySelectorAll('*').forEach(el => {
    const isInt = el.matches(INTER)
    const txt = ownText(el)
    if (!isInt && txt.length < 2) return
    if (!vis(el)) return
    const b = el.getBoundingClientRect()
    if (b.width < 1 || b.height < 1) return
    cands.push({ el, isInt, txt, b })
  })

  const res = { W, H, unreachable: [], truncated: [], tiny: [], smallHit: [], nCand: cands.length,
                docOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
                dialogs: [], focusables: 0 }
  const seen = new Set()
  for (const c of cands) {
    const el = c.el
    let b = c.b
    let cb = clipBox(el)
    const out0 = Math.max(cb.l - b.left, b.right - cb.r, cb.t - b.top, b.bottom - cb.b)
    if (out0 > 4) {
      // can scrolling reach it? save every ancestor scroll, try, restore
      const sc = scrollers(el)
      const save = sc.map(p => [p, p.scrollTop, p.scrollLeft])
      const wx = scrollX, wy = scrollY
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) } catch (e) {}
      const b2 = el.getBoundingClientRect()
      const cb2 = clipBox(el)
      const out1 = Math.max(cb2.l - b2.left, b2.right - cb2.r, cb2.t - b2.top, b2.bottom - cb2.b)
      for (const [p, st, sl] of save) { p.scrollTop = st; p.scrollLeft = sl }
      scrollTo(wx, wy)
      if (out1 > 4) {
        const k = cls(el) + '|' + Math.round(out1)
        if (!seen.has(k)) {
          seen.add(k)
          res.unreachable.push({ c: cls(el), hidden: Math.round(out1), scrollers: sc.length,
                                 rect: [Math.round(b2.left), Math.round(b2.top), Math.round(b2.right), Math.round(b2.bottom)],
                                 clip: [Math.round(cb2.l), Math.round(cb2.t), Math.round(cb2.r), Math.round(cb2.b)],
                                 t: c.txt.slice(0, 40) })
        }
      }
    }
    // truncated inline text (ellipsis / hidden overflow inside its own box)
    if (c.txt.length > 2 && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const cs = getComputedStyle(el)
      if (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') {
        const k = 'T' + cls(el)
        if (!seen.has(k)) { seen.add(k); res.truncated.push({ c: cls(el), have: el.clientWidth, need: el.scrollWidth, t: c.txt.slice(0, 40) }) }
      }
    }
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (c.txt.length > 2 && fs && fs < 11) {
      const k = 'F' + cls(el) + fs
      if (!seen.has(k)) { seen.add(k); res.tiny.push({ c: cls(el), px: +fs.toFixed(1), t: c.txt.slice(0, 30) }) }
    }
    if (c.isInt) {
      const cs = getComputedStyle(el)
      const clickable = cs.pointerEvents !== 'none' && !el.disabled
      if (clickable && (b.width < 24 || b.height < 24)) {
        const k = 'H' + cls(el)
        if (!seen.has(k)) { seen.add(k); res.smallHit.push({ c: cls(el), w: Math.round(b.width), h: Math.round(b.height), t: c.txt.slice(0, 24) }) }
      }
    }
  }
  document.querySelectorAll('[role="dialog"]').forEach(d => {
    if (!vis(d)) return
    res.dialogs.push({ c: cls(d), name: d.getAttribute('aria-label') || d.getAttribute('aria-labelledby') || null,
                       modal: d.getAttribute('aria-modal'), inert: !!(d.inert || (d.closest && d.closest('[inert]'))) })
  })
  res.focusables = Array.from(document.querySelectorAll(INTER)).filter(vis).length
  return res
}

  const scan = () => page.evaluate(SCAN)
  const SIZES = [[1920,1080],[900,620],[390,844]]
  const out = { panels: [], esc: [] }
  const openState = () => page.evaluate(() => {
    const q = c => { const e = document.querySelector(c); if (!e) return null
      const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !e.hasAttribute('hidden') && !e.inert }
    return { jr: q('.capyui-jr'), led: q('.capyui-led'), alb: q('.capyui-alb'),
             active: document.activeElement ? (document.activeElement.tagName + '.' + ((typeof document.activeElement.className === 'string' && document.activeElement.className) || '')) : null }
  })
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(900)
    const S = w + 'x' + h
    // journal
    await page.keyboard.press('KeyJ'); await page.waitForTimeout(900)
    let r = await scan(); r.size = S; r.panel = 'journal'; r.open = await openState(); out.panels.push(r)
    // ledger
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /laid out/.test(x.textContent)); if (b) b.click() })
    await page.waitForTimeout(1100)
    r = await scan(); r.size = S; r.panel = 'ledger'; r.open = await openState(); out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(700)
    out.esc.push({ size: S, after: 'ledger', st: await openState() })
    // album
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('button.capyui-jrled')).find(x => /album/.test(x.textContent)); if (b) b.click() })
    await page.waitForTimeout(1100)
    r = await scan(); r.size = S; r.panel = 'album'; r.open = await openState(); out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(700)
    out.esc.push({ size: S, after: 'album', st: await openState() })
    // journal with the key legend unfolded
    await page.keyboard.press('KeyH'); await page.waitForTimeout(900)
    r = await scan(); r.size = S; r.panel = 'journal+keys'; r.open = await openState()
    r.keysOpen = await page.evaluate(() => { const d = document.querySelector('details.capyui-jrkeys'); return d ? d.open : null })
    out.panels.push(r)
    await page.keyboard.press('Escape'); await page.waitForTimeout(700)
    out.esc.push({ size: S, after: 'journal', st: await openState() })
    // photo HUD
    await page.keyboard.press('KeyK'); await page.waitForTimeout(1200)
    r = await scan(); r.size = S; r.panel = 'photo'
    r.photoOn = await page.evaluate(() => window.__capy.hud.photoAudit().on)
    out.panels.push(r)
    await page.keyboard.press('KeyK'); await page.waitForTimeout(800)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-8.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
