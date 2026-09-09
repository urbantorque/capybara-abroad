async page => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.waitForTimeout(600)
  const out = {}
  out.pre = await page.evaluate(() => {
    const t = document.querySelector('.capyui-title')
    return { titleVisible: t ? getComputedStyle(t).display !== 'none' && !t.hasAttribute('hidden') : null,
             p1hidden: document.querySelector('.capyui-p1') && document.querySelector('.capyui-p1').hasAttribute('hidden'),
             p2hidden: document.querySelector('.capyui-p2') && document.querySelector('.capyui-p2').hasAttribute('hidden') }
  })
  // if on page 2, press the hero pick; else press the foot / go
  await page.evaluate(() => {
    const p2 = document.querySelector('.capyui-p2')
    if (p2 && !p2.hasAttribute('hidden')) { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() }
    else { const g = document.querySelector('button.capyui-go'); if (g) g.click() }
  })
  await page.waitForTimeout(1500)
  out.mid = await page.evaluate(() => ({ started: !!(window.__capy && window.__capy.state && window.__capy.state.started),
    p2hidden: document.querySelector('.capyui-p2') && document.querySelector('.capyui-p2').hasAttribute('hidden') }))
  if (!out.mid.started) {
    await page.evaluate(() => { const h = document.querySelector('button.capyui-pick.hero'); if (h) h.click() })
    await page.waitForTimeout(3000)
  }
  await page.waitForTimeout(3000)
  out.post = await page.evaluate(() => ({ started: !!(window.__capy && window.__capy.state && window.__capy.state.started),
    biome: window.__capy && window.__capy.state && window.__capy.state.biome }))
  // photo
  await page.keyboard.press('k'); await page.waitForTimeout(1400)
  out.photoOn = await page.evaluate(() => { const g = window.__capy; return { keys: Object.keys(g).slice(0, 40), photo: g.state && g.state.photo } })
  await page.keyboard.press('Enter'); await page.waitForTimeout(2000)
  await page.keyboard.press('k'); await page.waitForTimeout(1000)
  await page.keyboard.press('j'); await page.waitForTimeout(1000)
  out.album = await page.evaluate(() => Array.from(document.querySelectorAll('button.capyui-jrled')).map(b => ({ t: b.textContent.trim().slice(0, 26), hidden: b.hasAttribute('hidden') })))
  await page.keyboard.press('Escape'); await page.waitForTimeout(600)
  await page.evaluate(async (o) => { await fetch('/shot?name=b4ui-4.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
