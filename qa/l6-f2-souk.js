async page => {
  const TAG = 'l6-f2-souk'
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/'); await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => { window.__capy.completeTask('acrobats', true) })
  const tap = async (k, ms) => { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k) }
  const put = async (x, y, z) => page.evaluate(([x, y, z]) => { const b = window.__capy.capy.body; b.position.set(x, y, z); b.velocity.set(0, 0, 0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }, [x, y, z])
  const ev = async (f, a) => page.evaluate(f, a)
  const pos = async () => ev(() => { const p = window.__capy.capy.position; return [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] })
  const out = { rows: [] }
  await ev(() => window.__capy.hud.cross('sahara')); await page.waitForTimeout(9000)
  // walk west across an alley and see where the wall is: x from -36 to -42
    // now the chase, and hops at the x that stayed put nearest the wall
  await put(-38.8, 0.8, -58.4); await page.waitForTimeout(300); await ev(() => window.__capy.sahara.forceChase()); await page.waitForTimeout(700)
  for (const x of [-38.8, -38.8, -38.8]) {
    await put(x, 0.8, -58.4); await page.waitForTimeout(200)
    const p0 = await pos()
    await tap('Space', 90); await page.waitForTimeout(240); await tap('Space', 90); await page.waitForTimeout(1200)
    out.rows.push(['hop x', x, p0, await pos(), 'chasing', await ev(() => window.__capy.sahara.chasing()), 'vaultN', await ev(() => window.__capy.capy.vaultN), await ev(() => window.__capy.taskDone('souk-wall'))])
  }
  await page.evaluate(o => fetch('/shot?name=' + o.tag + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out, null, 1)))) }), { tag: TAG, out })
}
