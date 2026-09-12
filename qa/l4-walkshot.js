async page => {
  // L4 E1 — what the walking lens looks like. Three chapters, W held for
  // two seconds from the spawn, a frame mid-stride, then a frame after five
  // seconds standing (the rest lens with the flank drift and, with luck, the
  // look back). qa/l4w-<biome>-{walk,rest}.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const CH = [['sydney', null], ['venice', 'Digit0'], ['kowloon', 'Minus'], ['pasto', 'Digit2']]
  const out = { rows: [] }
  for (const [name, key] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    if (key) { await page.keyboard.press(key); await page.waitForTimeout(9000) }
    else { await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() }); await page.waitForTimeout(4500) }
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2200)
    await page.screenshot({ path: 'qa/l4w-' + name + '-walk.png', timeout: 90000 })
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(9000)
    await page.screenshot({ path: 'qa/l4w-' + name + '-rest.png', timeout: 90000 })
    const r = await page.evaluate(() => { const g = window.__capy, T = g.THREE; const v = new T.Vector3(); g.camera.getWorldDirection(v)
      return { biome: g.biome.current, started: g.state.started, pitch: +(Math.asin(-v.y) * 180 / Math.PI).toFixed(1), fov: g.camera.fov, rest: +g.camInfo.rest.toFixed(2), clear: +g.camInfo.clear.toFixed(2), err: g.state.lastError || null } })
    out.rows.push(r)
  }
  await page.evaluate((o) => fetch('/shot?name=l4-walkshot.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
