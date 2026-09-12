async page => {
  const out = {}
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k) }
  const snap = async (name) => {
    await page.screenshot({ path: 'qa/' + name + '.png' })
    out[name] = await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.body.position
      const v = new g.THREE.Vector3(p.x, p.y, p.z).project(g.camera)
      return { t: +g.state.time.toFixed(1), biome: g.biome.current, pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], camYaw: +(g.input.camYaw||0).toFixed(2), camPitch: +(g.input.camPitch||0).toFixed(2), cam: [+g.camera.position.x.toFixed(1), +g.camera.position.y.toFixed(1), +g.camera.position.z.toFixed(1)], vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(1), text: document.body.innerText.split('\n').map(s => s.trim()).filter(l => l && !(window.__pl && window.__pl.base.has(l))).slice(0, 40) }
    })
  }
  const drain = () => page.evaluate(() => { const s = (window.__pl || {}).seen || {}; const o = {}; for (const k in s) o[k] = [s[k].first, s[k].n]; return o })
  const post = (name, o) => page.evaluate(({ name, o }) => fetch('/shot?name=' + name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { name, o })
  out.inputKeys = await page.evaluate(() => Object.keys(window.__capy.input))
  await snap('l4r-player-sydney-12')
  // zoom back in with the wheel
  await page.mouse.wheel(0, -600); await page.waitForTimeout(700)
  await snap('l4r-player-sydney-13')
  // a short horizontal drag
  await page.mouse.move(640, 400); await page.mouse.down(); await page.mouse.move(340, 400, { steps: 15 }); await page.mouse.up()
  await page.waitForTimeout(600)
  await snap('l4r-player-sydney-14')
  // now walk W and see whether the camera keeps my turn
  await hold(['KeyW'], 2500)
  await snap('l4r-player-sydney-15')
  // try S: walk toward the camera
  await hold(['KeyS'], 2500)
  await snap('l4r-player-sydney-16')
  out.lines = await drain()
  await post('l4r-player-03.json', out)
}
