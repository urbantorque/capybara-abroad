async page => {
  // Every chapter, from tier 3: does one go up, is it level with the spawn,
  // and is it still STANDING ten seconds later? The last is the one a count
  // cannot answer — a poster on its face is still a poster in the array.
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(20, 6, 8, 0, 0) })

  const BIOMES = ['quay', 'kyoto', 'cali', 'rio', 'iceland', 'sahara', 'drift',
                  'venice', 'kowloon', 'palawan', 'goreme', 'manly', 'pantanal',
                  'cave', 'antarctic', 'monaco', 'hanoi', 'pasto', 'sydney']
  const rows = []
  for (const b of BIOMES) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(13000)
    rows.push(await page.evaluate((n) => {
      const g = window.__capy
      const p = (g.props || []).find(x => x && x.type === 'poster' && !x.removed &&
                                          x.biome === g.biome.current)
      if (!p) return { b: n, up: false }
      // Upright: the body's local +Y still points up. A poster on its face
      // reads near 0, one standing reads near 1.
      const q = p.body.quaternion
      const uy = 1 - 2 * (q.x * q.x + q.z * q.z)
      const cp = g.capy.position
      return { b: n, up: true, upright: +uy.toFixed(2),
               y: +p.body.position.y.toFixed(2),
               d: +Math.hypot(p.body.position.x - cp.x,
                              p.body.position.z - cp.z).toFixed(1) }
    }, b))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=poster-sweep.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs.slice(0, 6), errN: errs.length })
}
