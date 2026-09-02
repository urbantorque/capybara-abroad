async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(6500)
  const out = { errs: [] }

  // Sample the postcard's COMPUTED opacity and transform every 60 ms across a
  // crossing. A class that has been added proves nothing: a transition with no
  // start state to leave from does not run at all, and the element simply
  // appears at its destination — which is exactly what it did before.
  const sample = await page.evaluate(async () => {
    const g = window.__capy
    const rows = []
    // start the crossing, then watch. NOT the picker: Digit0 calls biomeGo
    // directly and skips the white entirely, which is why the first run of
    // this sampled three and a half seconds of an element with no class on it.
    g.hud.cross('venice')

    for (let i = 0; i < 60; i++) {
      const el = document.querySelector('.capyui-fademark')
      const nm = document.querySelector('.capyui-fadename')
      if (el) {
        const c = getComputedStyle(el)
        const cn = nm ? getComputedStyle(nm) : null
        const fd = document.querySelector('.capyui-fade')
        rows.push({ t: i * 60, cls: fd ? fd.className : null,
                    o: Math.round(parseFloat(c.opacity) * 1000) / 1000,
                    tr: c.transform === 'none' ? 'none' : c.transform.slice(0, 34),
                    nameCol: cn ? cn.color : null })
      }
      await new Promise(r => setTimeout(r, 60))
    }
    return rows
  })

  // condense: the distinct states the postcard passed through
  const seen = []
  for (const r of sample) {
    const k = r.o + '|' + r.tr
    if (!seen.length || seen[seen.length - 1].k !== k) seen.push({ k: k, t: r.t, o: r.o, tr: r.tr })
  }
  out.states = seen.length
  out.classes = Array.from(new Set(sample.map(r => r.cls)))
  out.first = sample[0] || null
  out.mid = sample[Math.floor(sample.length / 3)] || null
  out.last = sample[sample.length - 1] || null
  out.oMin = Math.min.apply(null, sample.map(r => r.o))
  out.oMax = Math.max.apply(null, sample.map(r => r.o))
  out.moved = sample.filter(r => r.tr !== 'none').length

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p7-cross.json', { method: 'POST', body: s })
  }, out)
}
