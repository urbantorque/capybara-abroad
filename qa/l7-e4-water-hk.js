async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: null }
  out.started = await page.evaluate(() => window.__capy && window.__capy.state && window.__capy.state.started)
  // KOWLOON AT NIGHT (L7, E4 / art #7): swim off the pier facing the shore; the
  // strip is the shore's edge (z = -61, x outside the pontoon) 0.5–3 m up and
  // the mirror of each point on the harbour between it and the lens.
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9000)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(9, -3.6, -84); b.velocity.set(0, 0, 0) })
  await page.waitForTimeout(400)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  await page.waitForTimeout(9000)
  const hk = async (tag) => page.evaluate((tag) => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const E = g.camera.position
    const wy = -4.2, zE = -61
    const proj = (x, y, z) => { const p = new T.Vector3(x, y, z).project(g.camera); return [Math.round((p.x + 1) * 0.5 * W), Math.round((1 - p.y) * 0.5 * H), p.z] }
    const rows = []
    for (let x = -11; x <= 11; x += 1) {
      if (Math.abs(x) < 5) continue
      for (const h of [0.5, 1, 1.5, 2, 2.5, 3]) {
        const t = (E.y - wy) / (E.y - (wy - h))
        const Q = [E.x + (x - E.x) * t, wy, E.z + (zE - E.z) * t]
        rows.push({ x, h, above: proj(x, wy + h, zE), below: proj(Q[0], Q[1], Q[2]) })
      }
    }
    return { tag, cam: E.toArray().map(v => +v.toFixed(2)), capy: g.capy.group.position.toArray().map(v => +v.toFixed(2)), swimming: !!g.capy.swimming, rows, err: g.state.lastError || null }
  }, tag)
  out.hk = await hk('on')
  await page.screenshot({ path: 'qa/l7-e4-water-hk.png' })
  await page.evaluate(() => { window.__capy.state.noMirror = true }); await page.waitForTimeout(350)
  out.hkOff = await hk('off')
  await page.screenshot({ path: 'qa/l7-e4-water-hk-off.png' })
  await page.evaluate(() => { window.__capy.state.noMirror = false })
  await page.evaluate((o) => fetch('/shot?name=l7-e4-water-hk.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
