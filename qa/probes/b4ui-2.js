async page => {
  const out = await page.evaluate(() => {
    const cls = el => (typeof el.className === 'string' && el.className.trim()) || el.id || el.tagName
    const path = el => { const a = []; let p = el; while (p && p.nodeType === 1 && a.length < 6) { a.push(p.tagName + '.' + cls(p)); p = p.parentElement } return a.join(' < ') }
    const o = { focusables: [], marquee: null, begin: [], all: [] }
    document.querySelectorAll('button,a[href],summary,input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])').forEach(el => {
      const b = el.getBoundingClientRect()
      o.focusables.push({ p: path(el), w: Math.round(b.width), h: Math.round(b.height), tab: el.tabIndex, txt: (el.textContent || '').trim().slice(0, 30) })
    })
    const sp = Array.from(document.querySelectorAll('span')).filter(s => /Beautiful, but|Come back|no\. No!/.test(s.textContent))
    if (sp[0]) { const b = sp[0].getBoundingClientRect(); o.marquee = { p: path(sp[0]), rect: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], anim: getComputedStyle(sp[0].parentElement).animationName, pcls: cls(sp[0].parentElement) } }
    Array.from(document.querySelectorAll('*')).forEach(el => {
      const t = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.nodeValue).join('').trim()
      if (/begin|BEGIN|click|press|start/i.test(t) && t.length < 60) { const b = el.getBoundingClientRect(); o.begin.push({ p: path(el), t: t.slice(0, 50), w: Math.round(b.width), h: Math.round(b.height), pe: getComputedStyle(el).pointerEvents }) }
    })
    o.clickTarget = (() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return el ? path(el) : null })()
    o.canvasTab = (() => { const c = document.querySelector('canvas'); return c ? { tabIndex: c.tabIndex, label: c.getAttribute('aria-label') } : null })()
    return o
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-2.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
