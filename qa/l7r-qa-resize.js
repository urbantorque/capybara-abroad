async page => {
  const st = await page.evaluate(() => !!(window.__capy && window.__capy.state.started))
  if (!st) {
    await page.goto('http://localhost:5190/', { waitUntil: 'domcontentloaded', timeout: 90000 })
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.__capyRunning && document.querySelector('.capyui-go')))) break }
    await page.waitForTimeout(1500)
    await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
    for (let i = 0; i < 80; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => !!(window.__capy && window.__capy.state.started))) break }
    await page.waitForTimeout(4000)
  }
  await page.evaluate(async () => { const g = window.__capy; if (g.biome.current !== 'venice') { g.hud.cross('venice'); await new Promise(r => setTimeout(r, 9000)) } })
  const out = []
  for (const [w, h] of [[1280, 720], [1920, 1080], [800, 600], [1280, 720]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(2500)
    const r = await page.evaluate(() => {
      const g = window.__capy
      const de = document.documentElement
      const els = {}
      const vw = innerWidth, vh = innerHeight
      const check = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return { hidden: true }; const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(0), y: +b.top.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0), over: b.right > vw + 1 || b.bottom > vh + 1 || b.left < -1 || b.top < -1, frac: +((b.width * b.height) / (vw * vh)).toFixed(3), font: cs.fontSize } }
      for (const s of ['.capyui-todo', '.capyui-map', '.capyui-toasts', '.capyui-stam', '.capyui-pips', '.capyui-fly', '.capyui-hint', '.capyui-live', '.capyui-place', '.capyui-arrow', '#hud']) els[s] = check(s)
      // minimum font size among visible hud text nodes
      let minFont = 99, minFontSel = null, textNodes = 0
      const hud = document.querySelector('#hud') || document.body
      for (const e of hud.querySelectorAll('*')) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue; if (!e.textContent || !e.textContent.trim() || e.children.length) continue; const b = e.getBoundingClientRect(); if (!b.width || !b.height || b.bottom < 0 || b.top > vh) continue; textNodes++; const f = parseFloat(cs.fontSize); if (f < minFont) { minFont = f; minFontSel = e.className || e.tagName } }
      const c = g.renderer.domElement
      return { vp: [vw, vh, devicePixelRatio], canvas: [c.width, c.height, c.clientWidth, c.clientHeight], dpr: g.renderer.getPixelRatio(), scroll: [de.scrollWidth, de.scrollHeight], scrollOver: de.scrollWidth > vw || de.scrollHeight > vh, aspect: +g.camera.aspect.toFixed(3), els, minFont, minFontSel, textNodes, rung: g.state.perfRung, lastError: g.state.lastError || null }
    })
    await page.screenshot({ path: 'qa/l7r-qa-resize-' + w + 'x' + h + '.png' })
    out.push(Object.assign({ size: w + 'x' + h }, r))
  }
  // the pause card at 800x600
  await page.setViewportSize({ width: 800, height: 600 })
  await page.waitForTimeout(1000)
  await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
  const pause = await page.evaluate(() => { const de = document.documentElement; const card = document.querySelector('.capyui-card'); const b = card ? card.getBoundingClientRect() : null; return { scroll: [de.scrollWidth, de.scrollHeight], card: b ? { x: +b.left.toFixed(0), y: +b.top.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0), over: b.bottom > innerHeight + 1 || b.right > innerWidth + 1 } : null, cardScroll: card ? [card.scrollHeight, card.clientHeight] : null } })
  await page.screenshot({ path: 'qa/l7r-qa-resize-800x600-pause.png' })
  await page.keyboard.press('Escape'); await page.waitForTimeout(800)
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(1200)
  const journal = await page.evaluate(() => { const de = document.documentElement; const card = document.querySelector('.capyui-jrcard'); const b = card ? card.getBoundingClientRect() : null; return { scroll: [de.scrollWidth, de.scrollHeight], card: b ? { x: +b.left.toFixed(0), y: +b.top.toFixed(0), w: +b.width.toFixed(0), h: +b.height.toFixed(0), over: b.bottom > innerHeight + 1 || b.right > innerWidth + 1 } : null, cardScroll: card ? [card.scrollHeight, card.clientHeight] : null } })
  await page.screenshot({ path: 'qa/l7r-qa-resize-800x600-journal.png' })
  await page.keyboard.press('KeyJ'); await page.waitForTimeout(500)
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.evaluate(async (o) => { await fetch('/shot?name=l7r-qa-resize.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }) }, { out, pause, journal })
}
