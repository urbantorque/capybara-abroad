async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(() => {
    const g = window.__capy
    if (!g) return { ok: false, keys: Object.keys(window).filter(k => /capy/i.test(k)) }
    return {
      ok: true,
      biome: g.biome.current,
      chapters: (g.CHAPTERS || []).length,
      tasks: (g.TASKS || []).length,
      lastError: g.state && g.state.lastError,
      gkeys: Object.keys(g),
      npcCount: g.npcs ? g.npcs.length : -1,
      props: g.props ? g.props.length : -1,
      chaos: g.state && g.state.chaos,
      capyKeys: g.capy ? Object.keys(g.capy).filter(k => /rest|still|loaf|sit/i.test(k)) : [],
    }
  })
  out.errs = errs.slice(0, 10)
  await page.evaluate(async o => { await fetch('/shot?name=pfsmoke.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
