async page => {
  // L4 E1 (a1): the AFTER set — qa/l4-shots.js verbatim, writing qa/l4b-*.png so
  // the morning's before-frames (qa/l4-*.png) are kept. One goto per chapter (trap 25: modules cache across goto, but no
  // source is edited during this run).
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  // PINNED TO 'pretty' (a1): under six builders' browsers the perf governor steps
  // down to DPR 0.6 and a 1024 shadow map, which is not the picture being measured.
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  const out = { rows: [], errs: [] }
  const have = async (p) => (await page.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).ok, 'http://localhost:5188/' + p))
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  if (!(await have('qa/l4b-title.png'))) await page.screenshot({ path: 'qa/l4b-title.png', timeout: 90000 })
  const KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon', 'Quote', 'Comma', 'Period', 'Slash']
  // RESUMABLE (a1): the machine was running six builders' browsers at once and a
  // 30 s screenshot timed out mid-run; a chapter whose frame exists is skipped.
  // run-code has no require (harness trap 14), so the check is a HEAD to the
  // dev server, which serves qa/ as static files.
  const NAMES = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (const key of KEYS) {
    await page.goto('http://localhost:5188/')
    if (await have('qa/l4b-' + NAMES[KEYS.indexOf(key)] + '-walk.png')) continue
    await page.waitForTimeout(5200)
    await page.keyboard.press(key)
    await page.waitForTimeout(11000)
    const info = await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current, started: !!g.state.started,
               calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles,
               err: g.state.lastError || null }
    })
    await page.screenshot({ path: 'qa/l4b-' + info.biome + '.png', timeout: 90000 })
    // a second frame after a short walk, so the animal is seen moving
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(400)
    await page.screenshot({ path: 'qa/l4b-' + info.biome + '-walk.png', timeout: 90000 })
    out.rows.push(Object.assign({ key: key }, info))
  }
  out.errs = errs.slice(0, 40)
  await page.evaluate((o) => fetch('/shot?name=l4b-shots.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}), out)
}
