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
  // THE REFLECTION's instruments (L7, E4 / art #7). The animal swims OFF the
  // shore facing it, so the lens sits over water looking at the things that
  // stand at its edge — the only geometry in which a reflection can be seen.
  // ---- THE QUAY BY DAY: the west piles of the middle wharf ------------------
  await page.evaluate(() => window.__capy.hud.cross('quay'))
  await page.waitForTimeout(9000)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(-9, -0.2, -6); b.velocity.set(0, 0, 0) })
  await page.waitForTimeout(400)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW')
  await page.waitForTimeout(9000)
  const quay = async (tag) => page.evaluate((tag) => {
    const g = window.__capy, T = g.THREE
    const W = g.renderer.domElement.width, H = g.renderer.domElement.height
    const E = g.camera.position
    const wy = -0.5
    const proj = (x, y, z) => { const p = new T.Vector3(x, y, z).project(g.camera); return [Math.round((p.x + 1) * 0.5 * W), Math.round((1 - p.y) * 0.5 * H), p.z] }
    const rows = []
    for (let i = 0; i < 5; i++) {
      const pz = -4 + 1.5 + i * 17 / 4, px = -4.25
      const dx = E.x - px, dz = E.z - pz, L = Math.sqrt(dx * dx + dz * dz)
      const nx = -dz / L, nz = dx / L
      for (const s of [0.06, 0.12, 0.18, 0.24, 0.30]) {
        const qx = px + dx * s, qz = pz + dz * s
        if (qz > 15) continue
        rows.push({ pile: [px, pz], s, col: proj(qx, wy, qz), side: proj(qx + nx * 2, wy, qz + nz * 2), side2: proj(qx - nx * 2, wy, qz - nz * 2) })
      }
    }
    return { tag, cam: E.toArray().map(v => +v.toFixed(2)), capy: g.capy.group.position.toArray().map(v => +v.toFixed(2)), swimming: !!g.capy.swimming, rows, bounce: g.bounceAudit(), err: g.state.lastError || null }
  }, tag)
  out.quay = await quay('on')
  await page.screenshot({ path: 'qa/l7-e4-water-quay.png' })
  await page.evaluate(() => { window.__capy.state.noMirror = true }); await page.waitForTimeout(350)
  out.quayOff = await quay('off')
  await page.screenshot({ path: 'qa/l7-e4-water-quay-off.png' })
  await page.evaluate(() => { window.__capy.state.noMirror = false })
  await page.evaluate((o) => fetch('/shot?name=l7-e4-water.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
