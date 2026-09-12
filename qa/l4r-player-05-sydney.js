async page => {
  const out = {}
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k) }
  const snap = async (name) => {
    await page.screenshot({ path: 'qa/' + name + '.png' })
    out[name] = await page.evaluate(() => {
      const g = window.__capy; const p = g.capy.body.position
      const v = new g.THREE.Vector3(p.x, p.y, p.z).project(g.camera)
      return { t: +g.state.time.toFixed(1), pos: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], ndc: [+v.x.toFixed(2), +v.y.toFixed(2)], vel: +Math.hypot(g.capy.body.velocity.x, g.capy.body.velocity.z).toFixed(1), text: document.body.innerText.split('\n').map(s => s.trim()).filter(l => l && !(window.__pl && window.__pl.base.has(l)) && !/DONE|way on|grab it|Knock over a bin/.test(l)).slice(0, 40) }
    })
  }
  const drain = () => page.evaluate(() => { const s = (window.__pl || {}).seen || {}; const o = {}; for (const k in s) o[k] = [s[k].first, s[k].n]; return o })
  const post = (name, o) => page.evaluate(({ name, o }) => fetch('/shot?name=' + name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { name, o })
  await hold(['KeyW'], 3000)
  await snap('l4r-player-sydney-21')
  await hold(['KeyE'], 3000)
  await snap('l4r-player-sydney-22')
  await page.waitForTimeout(1500)
  await snap('l4r-player-sydney-23')
  // swim a bit further, hop in water
  await hold(['KeyW'], 2000); await page.keyboard.press('Space'); await page.waitForTimeout(1200)
  await snap('l4r-player-sydney-24')
  out.lines = await drain()
  await post('l4r-player-05.json', out)
}
