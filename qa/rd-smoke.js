async page => {
  // rd-smoke.js — does it still boot, start, cross nineteen chapters, keep the
  // score running and stay off the console. The cheapest possible regression.
  const errs = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 220)) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(3000)
  const started = await page.evaluate(() => window.__capy.state.started)
  const list = ['pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift',
                'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                'cave', 'antarctic', 'monaco', 'hanoi', 'sydney']
  const rows = []
  for (const b of list) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(3600)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1100)
    await page.keyboard.up('KeyW')
    await page.keyboard.press('KeyQ')
    await page.waitForTimeout(700)
    rows.push(await page.evaluate(() => {
      const g = window.__capy
      const a = g.hud.musAudit ? g.hud.musAudit() : null
      return { cur: g.biome.current, err: g.state.lastError || null,
               t: +g.state.time.toFixed(1),
               capyY: +g.capy.position.y.toFixed(2),
               mus: a ? (a.voices !== undefined ? a.voices : (a.pal || 1)) : null,
               errStrip: (document.getElementById('err') || {}).style ?
                 document.getElementById('err').style.display : 'none' }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-smoke.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, { started, rows, errs: errs.slice(0, 30), errN: errs.length })
}
