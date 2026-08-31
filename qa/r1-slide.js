async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  const out = {}

  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)

  await page.evaluate(() => {
    window.__toasts = []
    const wrap = document.querySelector('.capyui-toasts')
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.textContent) window.__toasts.push(n.textContent)
      }
    }).observe(wrap, { childList: true })
  })

  out.biome = await page.evaluate(() => window.__capy.biome.current)

  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(2600)
  out.runSpeed = await page.evaluate(() => {
    const v = window.__capy.capy.velocity
    return +Math.hypot(v.x, v.z).toFixed(2)
  })
  out.afterRun = await page.evaluate(() => window.__toasts.slice())

  await page.keyboard.down('ControlLeft')
  await page.waitForTimeout(200)
  out.sliding = await page.evaluate(() => !!window.__capy.capy.sliding)
  await page.waitForTimeout(1600)
  await page.keyboard.up('ControlLeft')
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(1200)
  out.afterSlide = await page.evaluate(() => window.__toasts.slice())

  await page.waitForTimeout(1500)
  out.saved = await page.evaluate(() => {
    try {
      const o = JSON.parse(localStorage.getItem('capy3.journey.v1') || '{}')
      return { slid: o.slid === undefined ? null : o.slid, tasks: (o.tasks || []).length }
    } catch (e) { return { err: String(e) } }
  })

  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  await page.evaluate(() => {
    window.__toasts = []
    const wrap = document.querySelector('.capyui-toasts')
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.textContent) window.__toasts.push(n.textContent)
      }
    }).observe(wrap, { childList: true })
  })
  out.reloadBiome = await page.evaluate(() => window.__capy.biome.current)
  await page.keyboard.down('ShiftLeft')
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(3000)
  await page.keyboard.up('KeyW')
  await page.keyboard.up('ShiftLeft')
  await page.waitForTimeout(800)
  out.afterReload = await page.evaluate(() => window.__toasts.slice())

  out.legend = await page.evaluate(() => {
    const rows = []
    const legs = document.querySelectorAll('.capyui-legend')
    for (const l of legs) {
      const kb = Array.from(l.querySelectorAll('kbd')).map(k => k.textContent)
      rows.push(kb)
    }
    return rows
  })

  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=r1-slide.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
