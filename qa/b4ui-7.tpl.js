async page => {
  const SCAN = /*SCAN*/
  const scan = () => page.evaluate(SCAN)
  const SIZES = __SIZES__
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
  await page.evaluate(async (o) => { await fetch('/shot?name=__OUT__', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
