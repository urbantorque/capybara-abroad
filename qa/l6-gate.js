async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started) }
  await page.evaluate(() => { window.__capy.hud.cross('venice') })
  await page.waitForTimeout(9000)
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  // A Sydney row asked for from Venice: refused. A Venice row: taken.
  out.abroad = await page.evaluate(() => {
    const g = window.__capy
    g.events.emit('task:complete', { id: 'bin-chicken' })
    g.events.emit('task:complete', { id: 'dog-loose' })
    g.events.emit('task:complete', { id: 'pigeon-storm' })
    return { bin: g.taskDone('bin-chicken'), dog: g.taskDone('dog-loose'), pigeons: g.taskDone('pigeon-storm') }
  })
  await page.evaluate(() => { window.__capy.hud.cross('sydney') })
  await page.waitForTimeout(9000)
  out.home = await page.evaluate(() => {
    const g = window.__capy
    g.events.emit('task:complete', { id: 'bin-chicken' })
    return { biome: g.biome.current, bin: g.taskDone('bin-chicken'), arrive: g.taskDone('to-sydney') }
  })
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=l6-gate.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
  return out
}
