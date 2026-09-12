async page => {
  const out = {}
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k) }
  const snap = async (name) => {
    await page.screenshot({ path: 'qa/' + name + '.png' })
    out[name] = await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.body.position
      const v = new g.THREE.Vector3(p.x, p.y, p.z).project(g.camera)
      return { t: +g.state.time.toFixed(1), biome: g.biome.current, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(1), text: document.body.innerText.split('\n').map(s => s.trim()).filter(l => l && !(window.__pl && window.__pl.base.has(l))).slice(0, 40) }
    })
  }
  const drain = () => page.evaluate(() => { const s = (window.__pl || {}).seen || {}; const o = {}; for (const k in s) o[k] = [s[k].first, s[k].n]; return o })
  const post = (name, o) => page.evaluate(({ name, o }) => fetch('/shot?name=' + name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { name, o })
  // reset the line sampler baseline for the new chapter
  await page.evaluate(() => { if (window.__pl) window.__pl.seen = {} })
  // Esc -> quit to title -> pick Iceland (a player would go through the menu)
  const quit = await page.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(e => /QUIT TO THE TITLE/i.test(e.textContent)); const b = bs[bs.length - 1]; if (b) { b.click(); return bs.length } return 0 })
  out.quit = quit
  await page.waitForTimeout(2500)
  await snap('l4r-player-iceland-01-title')
  await page.keyboard.press('Digit7')
  await page.waitForTimeout(10000)
  await snap('l4r-player-iceland-02')
  await page.waitForTimeout(3000)
  await snap('l4r-player-iceland-03')
  await hold(['KeyW'], 3000)
  await snap('l4r-player-iceland-04')
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(2000)
  await hold(['KeyW', 'ShiftLeft'], 3000)
  await snap('l4r-player-iceland-05')
  out.lines = await drain()
  await post('l4r-player-11.json', out)
}
