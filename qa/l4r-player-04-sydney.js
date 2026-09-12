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
  await hold(['KeyW', 'KeyA'], 1500)
  await hold(['KeyW'], 1500)
  await snap('l4r-player-sydney-17')
  await hold(['KeyW'], 1500)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(600)
  await snap('l4r-player-sydney-18')
  await page.keyboard.down('ShiftLeft'); await hold(['KeyW'], 1500); await page.keyboard.up('ShiftLeft')
  await page.keyboard.press('KeyE'); await page.waitForTimeout(800)
  await snap('l4r-player-sydney-19')
  await hold(['KeyW'], 1200)
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500)
  await snap('l4r-player-sydney-20')
  out.lines = await drain()
  await post('l4r-player-04.json', out)
}
