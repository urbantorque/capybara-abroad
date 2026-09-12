async page => {
  const IDS1 = ['wheek', 'steal-hat', 'coffee-spill', 'picnic-thief', 'bin-chicken', 'dig-flower', 'chased', 'photo-op', 'opera-stage', 'ball-harbour', 'swim', 'hat-harbour', 'cafe-table', 'busker-hat', 'dog-loose']
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(3000)
  await page.evaluate((ids) => {
    localStorage.clear()
    localStorage.setItem('capy3.journey.v1', JSON.stringify({ v: 1, tasks: ids, seen: [1], recs: {}, told: 1, ms: 900000, chapms: { 1: 900000 }, finds: [], foundAt: {}, biome: 'sydney', fin: 0 }))
  }, IDS1)
  await page.reload()
  await page.waitForTimeout(5200)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  const out = await page.evaluate(() => {
    const g = window.__capy, h = g.hud
    const c = g.gateInfo ? g.gateInfo(1) : null
    let err = null
    const tb = g.state.transBusy; try { h.travel(2) } catch (e) { err = String(e && e.stack || e).slice(0, 300) }
    return { started: g.state.started, chap: c ? JSON.stringify(c).slice(0, 600) : null, open2: g.gateInfo ? JSON.stringify(g.gateInfo(2)).slice(0,300) : null, err, leave: h.leaveAudit(), paused: g.state.paused, lastError: g.state.lastError }
  })
  await page.waitForTimeout(3000)
  out.after = await page.evaluate(() => ({ biome: window.__capy.biome.current, leave: window.__capy.hud.leaveAudit(), fade: (document.querySelector('.capyui-fade') || {}).className }))
  await page.evaluate((o) => fetch('/shot?name=l4-depart-dbg.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
