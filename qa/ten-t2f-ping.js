async page => {
  // T2f, noEchoPing and the first-echo lesson. Fresh profile, rung pinned to 0 (pf 1).
  // (1) Q at the spawn (daylight): first-echo must NOT tick, the daylight line must say once.
  // (2) Q stood on the hint arrow's target (game.cave.mouth): first-echo ticks on one press.
  // (3) Q in the dark passage near the west wall: marks cast, marks on a face, most lit at
  //     once, and the picture at 0.5 / 1.0 / 1.6 s. Then the flag, same pose: nothing cast.
  const NAME = 'ten-t2f-ping'
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5196/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() }); await page.waitForTimeout(6000)
  const out = {}
  for (let i = 0; i < 3; i++) {
    if (await page.evaluate(() => window.__capy.biome.current) === 'cave') break
    await page.evaluate(() => { const g = window.__capy; g.state.journeyMode = 'free'; g.hud.cross('cave') }); await page.waitForTimeout(11000)
  }
  await page.evaluate(() => { window.__capy.state.journeyMode = 'story' })
  out.biome = await page.evaluate(() => window.__capy.biome.current)
  await page.evaluate(() => {
    const g = window.__capy; window.__t2fT = []
    const o = g.toast; g.toast = function (t, k) { window.__t2fT.push(t); return o.apply(this, arguments) }
  })
  const put = (q) => page.evaluate(q => {
    const g = window.__capy, b = g.capy.body, h = g.cave.terrainHeight(q.x, q.z)
    b.position.set(q.x, h + 0.6, q.z); b.velocity.set(0, 0, 0)
    if (b.previousPosition) b.previousPosition.copy(b.position)
    if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position)
    return +h.toFixed(2)
  }, q)
  const q = async () => { await page.keyboard.down('q'); await page.waitForTimeout(90); await page.keyboard.up('q') }
  // (1) the spawn
  await put({ x: 0, z: 62 }); await page.waitForTimeout(1500)
  await q(); await page.waitForTimeout(1300); await q(); await page.waitForTimeout(1300)
  out.spawn = await page.evaluate(() => ({ tick: window.__capy.taskDone('first-echo'), toasts: window.__t2fT.slice(), ping: window.__capy.cave.ping() }))
  // (2) the hint target
  out.mouth = await page.evaluate(() => { const g = window.__capy, m = g.cave.mouth; return { x: m.x, z: m.z, water: g.cave.navBlocked(m.x, m.z, 0.5) } })
  await put({ x: out.mouth.x, z: out.mouth.z }); await page.waitForTimeout(1600)
  out.mouthDay = await page.evaluate(() => window.__capy.cave.daylight())
  await q(); await page.waitForTimeout(700)
  out.mouthTick = await page.evaluate(() => ({ tick: window.__capy.taskDone('first-echo'), toasts: window.__t2fT.slice() }))
  // (3) the dark passage, twelve metres off the west wall's drawn face
  const P = { x: 32, z: -14 }
  await put(P); await page.waitForTimeout(3000)
  out.passDay = await page.evaluate(() => window.__capy.cave.daylight())
  await q()
  const rows = []
  for (const [ms, tag] of [[500, 'a'], [500, 'b'], [600, 'c']]) {
    await page.waitForTimeout(ms)
    rows.push(await page.evaluate(() => window.__capy.cave.ping()))
    await page.screenshot({ path: 'qa/' + NAME + '-live-' + tag + '.png' })
  }
  out.live = rows
  await page.waitForTimeout(2500)
  out.after = await page.evaluate(() => window.__capy.cave.ping())
  // the flag, same place
  await page.evaluate(() => { window.__capy.state.noEchoPing = true })
  await q(); await page.waitForTimeout(1000)
  out.off = await page.evaluate(() => window.__capy.cave.ping())
  await page.screenshot({ path: 'qa/' + NAME + '-off-b.png' })
  await page.evaluate(() => { window.__capy.state.noEchoPing = false })
  await page.waitForTimeout(2000)
  // rung 1 parks it
  await page.evaluate(() => { const g = window.__capy; g.__t2fR = g.state.perfRung; g.state.perfRung = 1 })
  await q(); await page.waitForTimeout(400)
  out.rung1 = await page.evaluate(() => window.__capy.cave.ping())
  await page.evaluate(() => { const g = window.__capy; g.state.perfRung = g.__t2fR })
  out.rung = await page.evaluate(() => window.__capy.state.perfRung)
  out.err = await page.evaluate(() => window.__capy.state.lastError || null)
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { name: NAME, out })
}
