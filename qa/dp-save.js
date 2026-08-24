async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  await page.evaluate(async () => {
    const g = window.__capy
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    for (const id of ['wheek', 'opera-stage', 'ferry-hop', 'bin-chicken']) {
      g.completeTask(id); await sleep(150)
    }
    await sleep(1500)
  })

  const before = await page.evaluate(() => ({
    score: window.__capy.state.score,
    save: (localStorage.getItem('capy3.journey.v1') || '').length,
  }))

  await page.reload()
  await page.waitForTimeout(5500)
  const atTitle = await page.evaluate(() => ({
    save: (localStorage.getItem('capy3.journey.v1') || '').length,
    started: window.__capy.state.started,
  }))

  await page.evaluate(() => { const m = document.querySelector('.capyui-more'); if (m) m.click() })
  await page.waitForTimeout(1200)
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.capyui-pick')]
    if (t[1]) t[1].click()
  })
  await page.waitForTimeout(7000)

  const after = await page.evaluate(() => ({
    score: window.__capy.state.score,
    save: (localStorage.getItem('capy3.journey.v1') || '').length,
    biome: window.__capy.biome.current,
  }))

  await page.evaluate(async o => {
    await fetch('/shot?name=dpsave.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, { before, atTitle, after })
}
