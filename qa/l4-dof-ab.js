async page => {
  // L4 E1 (a1) — HOW MUCH OF THE PICTURE THE DEFOCUS STILL EATS. Venice, Sahara,
  // Pasto, Sydney at the settled lens: a frame with the row as shipped, then
  // game.state.noDof for a beat and a frame with no defocus at all. The value
  // script's edge% on the pair is the defocus's own cost — the review's
  // "edge 4.4 % -> 9.1 %" was this pair on the old 0.65 row. A before/after
  // against the morning's frames confounds the row with the crowd, the clouds
  // and the key. Frames: qa/l4d-<biome>-{dof,nodof}.png
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })   // pinned to 'pretty' (a1): the perf governor under load is not the picture
  const CH = [['Digit0', 'venice'], ['Digit8', 'sahara'], ['Digit2', 'pasto'], ['Digit1', 'sydney']]
  const out = { rows: [] }
  for (const [key, name] of CH) {
    await page.goto('http://localhost:5188/')
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(10000)
    const P = () => page.evaluate(() => { const p = window.__capy.post.params; return { dof: +p.dof.toFixed(2), far0: +p.dofFar0.toFixed(1), far1: +p.dofFar1.toFixed(1) } })
    const on = await P()
    await page.screenshot({ path: 'qa/l4d-' + name + '-dof.png', timeout: 90000 })
    await page.evaluate(() => { window.__capy.state.noDof = true })
    await page.waitForTimeout(400)
    const off = await P()
    await page.screenshot({ path: 'qa/l4d-' + name + '-nodof.png', timeout: 90000 })
    await page.evaluate(() => { window.__capy.state.noDof = false })
    out.rows.push({ name, biome: await page.evaluate(() => window.__capy.biome.current), on, off, err: await page.evaluate(() => window.__capy.state.lastError || null) })
  }
  await page.evaluate((o) => fetch('/shot?name=l4-dof-ab.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
