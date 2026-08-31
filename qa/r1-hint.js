async page => {
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  const out = {}

  await page.evaluate(() => {
    window.__toasts = []
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.textContent) window.__toasts.push(n.textContent)
      }
    }).observe(document.querySelector('.capyui-toasts'), { childList: true })
  })

  const put = async (biome, x, y, z) => {
    await page.evaluate(([b, px, py, pz]) => {
      const g = window.__capy
      if (g.biome.current !== b) g.biome.switchTo(b)
      const bd = g.capy.body
      bd.position.set(px, py, pz); bd.velocity.set(0, 0, 0)
      bd.previousPosition.copy(bd.position); bd.interpolatedPosition.copy(bd.position)
    }, [biome, x, y, z])
    await page.waitForTimeout(1600)
  }

  await put('sydney', -40, 0.6, -20.5)
  out.sydneyPrompt = await page.evaluate(() => {
    const el = document.querySelector('.capyui-home')
    return !!(el && el.classList.contains('show'))
  })
  out.afterSydney = await page.evaluate(() => window.__toasts.slice())

  const crater = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('pasto')
    const c = g.pasto && g.pasto.craterCentre
    return c ? { x: c.x, z: c.z } : null
  })
  out.crater = crater
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__toasts = [] })
  if (crater) await put('pasto', crater.x, 40, crater.z)
  await page.waitForTimeout(2500)
  out.pastoPrompt = await page.evaluate(() => {
    const el = document.querySelector('.capyui-home')
    const p = window.__capy.capy.position
    return { shown: !!(el && el.classList.contains('show')),
             text: el ? el.textContent : null,
             x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }
  })
  out.afterPasto = await page.evaluate(() => window.__toasts.slice())
  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=r1-hint.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
