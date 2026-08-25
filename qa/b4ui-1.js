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
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  const SIZES = [[1280, 720], [1366, 768], [1600, 900], [1920, 1080], [900, 620], [390, 844]]
  const out = { title: [], setup: null }
  out.setup = await page.evaluate(() => ({
    started: !!(window.__capy && window.__capy.state && window.__capy.state.started),
    hud: document.querySelectorAll('[class^="capyui-"]').length,
    body: document.body.innerText.slice(0, 200)
  }))
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(900)
    const r = await scan()
    r.size = w + 'x' + h
    out.title.push(r)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-1.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
