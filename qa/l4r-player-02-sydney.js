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

  // look around with the mouse: drag to turn the camera right around
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(1240, 400, { steps: 20 }); await page.mouse.up()
  await page.waitForTimeout(800)
  await snap('l4r-player-sydney-07')
  // walk back toward where the hat man was
  await hold(['KeyW'], 3500)
  await snap('l4r-player-sydney-08')
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1200)
  await snap('l4r-player-sydney-09')
  // try the mouse wheel to zoom out and see more
  await page.mouse.wheel(0, 600); await page.waitForTimeout(800)
  await snap('l4r-player-sydney-10')
  // walk on, wheek at the crowd, press E a few times in passing
  await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200); await page.keyboard.press('KeyE'); await page.waitForTimeout(1200); await page.keyboard.press('KeyQ'); await page.waitForTimeout(1200); await page.keyboard.press('KeyE')
  await page.waitForTimeout(800); await page.keyboard.up('KeyW')
  await snap('l4r-player-sydney-11')
  out.lines = await drain()
  await post('l4r-player-02.json', out)
}
