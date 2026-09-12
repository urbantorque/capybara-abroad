async page => {
  const out = {}
  const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await page.waitForTimeout(ms); for (const k of keys) await page.keyboard.up(k) }
  const install = () => page.evaluate(() => {
    if (window.__pl) return
    const base = new Set(document.body.innerText.split('\n').map(s => s.trim()))
    const seen = {}
    const g = window.__capy
    window.__pl = { base, seen, t0: g.state.time }
    setInterval(() => {
      const t = g.state.time
      for (const raw of document.body.innerText.split('\n')) {
        const l = raw.trim(); if (!l || base.has(l)) continue
        const s = seen[l]; if (s) { if (t - s.last > 1.5) s.n++; s.last = t } else seen[l] = { first: +t.toFixed(1), last: t, n: 1 }
      }
    }, 250)
  })
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

  await install()
  // 1. the card says press Q anywhere
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(2500)
  await snap('l4r-player-sydney-01')
  // 2. walk forward toward the people
  await hold(['KeyW'], 3000)
  await snap('l4r-player-sydney-02')
  // 3. run and hop
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW')
  await page.waitForTimeout(1200); await page.keyboard.press('Space'); await page.waitForTimeout(1500); await page.keyboard.press('Space'); await page.waitForTimeout(1300)
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
  await snap('l4r-player-sydney-03')
  // 4. try grabbing whatever is near
  await page.keyboard.press('KeyE'); await page.waitForTimeout(1500)
  await snap('l4r-player-sydney-04')
  // 5. wheek at the people
  await page.keyboard.press('KeyQ'); await page.waitForTimeout(2500)
  await snap('l4r-player-sydney-05')
  // 6. turn left and walk, see what is there
  await hold(['KeyA'], 2500)
  await hold(['KeyW'], 3000)
  await snap('l4r-player-sydney-06')
  out.lines = await drain()
  await post('l4r-player-01.json', out)
}
