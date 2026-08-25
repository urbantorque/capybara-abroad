async page => {
  const out = { samples: [] }
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  for (let i = 0; i < 14; i++) {
    const s = await page.evaluate(() => {
      const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
      const path = el => { const a = []; let p = el; while (p && p.nodeType === 1 && a.length < 5) { a.push(p.tagName + '.' + cls(p)); p = p.parentElement } return a.join('<') }
      const o = []
      document.querySelectorAll('*').forEach(el => {
        if (el.children.length) return
        const t = (el.textContent || '').trim()
        if (t.length < 3) return
        const cs = getComputedStyle(el)
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return
        const b = el.getBoundingClientRect()
        if (b.width < 2) return
        if (b.left < -1 || b.right > innerWidth + 1 || b.top < -1 || b.bottom > innerHeight + 1) {
          o.push({ p: path(el), t: t.slice(0, 34), r: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], w: innerWidth, h: innerHeight })
        }
      })
      return o
    })
    if (s.length) out.samples.push(s)
    await page.waitForTimeout(1500)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-12.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
