async page => {
  const TAG = 'l6-f2-rows3'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { for (const t of ['acrobats', 'driftseed']) window.__capy.completeTask(t, true) })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const aim = async (mx, mz) => {
    const want = Math.atan2(-mx, -mz)
    for (let k = 0; k < 8; k++) {
      const have = await ev(() => window.__capy.input.camYaw)
      let d = want - have; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) < 0.06) return +have.toFixed(2)
      await page.mouse.move(640, 380); await page.mouse.down()
      await page.mouse.move(640 - d / 0.005 * 0.5, 380, { steps: 6 }); await page.mouse.up()
      await page.waitForTimeout(400)
    }
    return 'aim failed'
  }
  const pos = async () => ev(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)] })
  const out = { rows: [] }
  // ---- Marrakech: a wall-kick in the souk with the chase on ---------------
  await ev(() => window.__capy.hud.cross('sahara')); await page.waitForTimeout(9000)
  await ev(() => window.__capy.sahara.forceChase()); await page.waitForTimeout(2500)
  const ch = await ev(() => window.__capy.sahara.chasing())
  const y = await ev(() => window.__capy.sahara.terrainHeight ? window.__capy.sahara.terrainHeight(-39.9, -58.4) : 0)
  await put(-39.9, y + 0.7, -58.4); await page.waitForTimeout(600)
  const v0 = await ev(() => window.__capy.capy.vaultN)
  for (let k = 0; k < 5; k++) { await put(-40.2, y + 0.7, -58.4 + k * 0.8); await page.waitForTimeout(500); await tap('Space', 90); await page.waitForTimeout(240); await tap('Space', 90); await page.waitForTimeout(1200); if (await ev(() => window.__capy.capy.vaultN)) break }
  out.rows.push(['sahara', 'souk-wall', await ev(() => window.__capy.taskDone('souk-wall')), 'chasing ' + ch + ' vaultN ' + v0 + '->' + await ev(() => window.__capy.capy.vaultN), await pos(), await ev(() => window.__capy.state.lastError || null)])
  // ---- the Drift: the gap on the seed, no puff ----------------------------
  if (false) await ev(() => window.__capy.hud.cross('drift')); await page.waitForTimeout(9000)
  for (let t = 0; t < 0; t++) {
    await put(11, 88.6, -110); await page.waitForTimeout(1200)
    const yaw = await aim(0.75, -0.66)
    const s0 = await ev(() => window.__capy.capy.seedT)
    await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(900)
    await page.keyboard.down('Space'); await page.waitForTimeout(9000)
    await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft')
    const r = ['drift', 'seed-gap', await ev(() => window.__capy.taskDone('seed-gap')), 'try ' + t + ' yaw ' + yaw + ' seedT +' + (+(await ev(() => window.__capy.capy.seedT) - s0).toFixed(2)) + ' wind ' + await ev(() => +window.__capy.drift.windSpeed().toFixed(1)) + ' long-gap ' + await ev(() => window.__capy.taskDone('long-gap')), await pos(), await ev(() => window.__capy.state.lastError || null)]
    out.rows.push(r)
    if (r[2]) break
    await page.waitForTimeout(3000)
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
