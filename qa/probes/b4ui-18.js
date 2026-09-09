async page => {
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const parse = s => { const m = s.match(/[\d.]+/g); return m ? [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]] : null }
    const over = (fg, bg) => [0, 1, 2].map(i => fg[3] * fg[i] + (1 - fg[3]) * bg[i])
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    const L = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    const ratio = (a, b) => { const la = L(a), lb = L(b); return +(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05))).toFixed(2) }
    const bgOf = el => {
      let p = el, acc = null
      while (p && p.nodeType === 1) {
        const c = parse(getComputedStyle(p).backgroundColor)
        if (c && c[3] > 0) { acc = acc ? over(acc.concat([1]), c) : [c[0], c[1], c[2]]; if (c[3] >= 0.999) return acc }
        p = p.parentElement
      }
      return acc || [255, 255, 255]
    }
    const effOpacity = el => { let o = 1, p = el; while (p && p.nodeType === 1) { o *= +getComputedStyle(p).opacity; p = p.parentElement } return o }
    const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
    const res = []
    const seen = new Set()
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length) return
      const t = (el.textContent || '').trim()
      if (t.length < 3) return
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') return
      const b = el.getBoundingClientRect()
      if (b.width < 2 || b.height < 2) return
      const k = cls(el)
      if (seen.has(k)) return
      const fg = parse(cs.color); if (!fg) return
      const bg = bgOf(el)
      const op = effOpacity(el)
      const fgc = over([fg[0], fg[1], fg[2], fg[3] * op], bg)
      const fs = parseFloat(cs.fontSize)
      const bold = +cs.fontWeight >= 700
      const need = (fs >= 24 || (fs >= 18.66 && bold)) ? 3 : 4.5
      const r = ratio(fgc, bg)
      if (r < need) { seen.add(k); res.push({ c: k, r, need, px: +fs.toFixed(1), op: +op.toFixed(2), t: t.slice(0, 34) }) }
    })
    return { biome: window.__capy.biome.current, fails: res }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-18.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
