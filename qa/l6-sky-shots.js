async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const tag = await page.evaluate(() => (window.__capy && window.__capy.state && window.__capy.state.shotTag) || 'x')
  const out = { started: null, tag, rows: [] }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  const info = async (t) => page.evaluate((t) => {
    const g = window.__capy, r = g.renderer
    // the CONTRACT idiom: autoReset off, reset, one tick, read — main pass plus shadow pass
    r.info.autoReset = false; r.info.reset()
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
      const c = r.info.render.calls, tri = r.info.render.triangles
      r.info.autoReset = true
      res({ tag: t, biome: g.biome.current, calls: c, tris: tri, err: g.state.lastError ? String(g.state.lastError) : null })
    })))
  }, t)
  const CH = ['sydney', 'rio', 'sahara', 'palawan', 'kowloon', 'iceland', 'monaco', 'hanoi']
  for (const c of CH) {
    if (c !== 'sydney') {
      await page.evaluate((c) => window.__capy.hud.cross(c), c)
      await page.waitForTimeout(9000)
    } else await page.waitForTimeout(2500)
    await page.screenshot({ path: 'qa/l6-sky-' + c + '-arrive.png' })
    out.rows.push(await info('arrive'))
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(3200)
    await page.screenshot({ path: 'qa/l6-sky-' + c + '-walk.png' })
    out.rows.push(await info('walk'))
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(14000)
    await page.screenshot({ path: 'qa/l6-sky-' + c + '-rest.png' })
    out.rows.push(await info('rest'))
  }
  await page.evaluate((o) => fetch('/shot?name=l6-sky-shots.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
