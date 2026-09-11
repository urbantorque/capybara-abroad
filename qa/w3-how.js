async page => {
  // w3-how: the signpost's how-line, the boarding lines in Cali and Cappadocia,
  // and the burner line that had never once been drawn.
  await page.setViewportSize({ width: 1400, height: 800 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload(); await page.waitForTimeout(4500)
  await page.keyboard.press('Digit1'); await page.waitForTimeout(5000)
  const out = {}
  const card = () => page.evaluate(() => {
    const q = s => { const e = document.querySelector(s); return e ? e.textContent : null }
    const g = window.__capy
    return { biome: g.biome.current, cls: (document.querySelector('.capyui-marq') || {}).className,
             name: q('.capyui-marqname'), how: q('.capyui-marqhow'), say: q('.capyui-marqsay'),
             toasts: Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent), err: g.state.lastError || null }
  })
  const tp = (name, x, y, z) => page.evaluate(([name, x, y, z]) => {
    const g = window.__capy; if (g.biome.current !== name) g.biome.switchTo(name)
    const b = g.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
  }, [name, x, y, z])
  out.sydney = await card()
  // Cali: near the parked bus
  await page.evaluate(() => window.__capy.biome.switchTo('cali')); await page.waitForTimeout(2500)
  out.caliFar = await card()
  const lad = await page.evaluate(() => { const l = window.__capy.cali.chivaLadder(); return { x: l.x, y: l.y, z: l.z } })
  await tp('cali', lad.x, lad.y + 0.5, lad.z + 3)
  await page.waitForTimeout(1500)
  out.caliNear = await card()
  await page.screenshot({ path: 'qa/w3-cali-ladder.png' })
  // Cappadocia: near the basket, then in it
  await page.evaluate(() => window.__capy.biome.switchTo('goreme')); await page.waitForTimeout(2500)
  out.gorFar = await card()
  const bal = await page.evaluate(() => { const b = window.__capy.goreme.balloon(); return { x: b.x, y: b.y, z: b.z } })
  await tp('goreme', bal.x + 4, bal.y + 0.5, bal.z)
  await page.waitForTimeout(1500)
  out.gorNear = await card()
  await tp('goreme', bal.x, bal.y + 0.6, bal.z)
  await page.waitForTimeout(1500)
  out.gorAboard = await card()
  await page.screenshot({ path: 'qa/w3-goreme-basket.png' })
  // a few more cards, for the how line
  for (const b of ['quay', 'kowloon', 'antarctic', 'monaco', 'palawan', 'hanoi']) {
    await page.evaluate((n) => window.__capy.biome.switchTo(n), b); await page.waitForTimeout(2200)
    out[b] = await card()
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=w3how.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
