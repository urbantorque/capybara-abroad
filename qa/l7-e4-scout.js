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
  // ---- the Quay: the bounce pool at the rest lens, and where the wharf piles are
  await page.evaluate(() => window.__capy.hud.cross('quay'))
  await page.waitForTimeout(9000)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3200); await page.keyboard.up('KeyW')
  await page.waitForTimeout(14000)
  out.quay = await page.evaluate(() => {
    const g = window.__capy
    const emis = []
    g.scene.traverse(o => {
      if (!o.isMesh) return
      let v = true; o.traverseAncestors(a => { if (!a.visible) v = false }); if (!o.visible) v = false
      if (!v) return
      const m = Array.isArray(o.material) ? o.material[0] : o.material
      if (m && m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) {
        const p = new g.THREE.Vector3(); o.getWorldPosition(p)
        emis.push([+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), o.name || m.name || ''])
      }
    })
    return { cam: g.camera.position.toArray().map(v => +v.toFixed(1)), capy: g.capy.group.position.toArray().map(v => +v.toFixed(1)),
      yaw: +g.capy.group.rotation.y.toFixed(2), camYaw: +g.input.camYaw.toFixed(2), bounce: g.bounceAudit(), emis: emis.slice(0, 12), emisN: emis.length,
      info: Object.assign({}, g.camInfo), bg: g.scene.background && g.scene.background.isColor ? g.scene.background.getHexString() : null }
  })
  await page.screenshot({ path: 'qa/l7-e4-scout-quay.png' })
  // ---- Kowloon: teleport to the pier, face the harbour
  await page.evaluate(() => window.__capy.hud.cross('kowloon'))
  await page.waitForTimeout(9000)
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; b.position.set(0, 1.2, -63); b.velocity.set(0, 0, 0); g.capy.group.rotation.y = Math.PI })
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyC')
  await page.waitForTimeout(3000)
  out.hk = await page.evaluate(() => {
    const g = window.__capy
    const emis = []
    g.scene.traverse(o => {
      if (!o.isMesh) return
      let v = true; o.traverseAncestors(a => { if (!a.visible) v = false }); if (!o.visible) v = false
      if (!v) return
      const m = Array.isArray(o.material) ? o.material[0] : o.material
      if (m && m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) {
        const p = new g.THREE.Vector3(); o.getWorldPosition(p)
        if (p.z < -40) emis.push([+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), +m.emissiveIntensity.toFixed(2)])
      }
    })
    return { cam: g.camera.position.toArray().map(v => +v.toFixed(1)), capy: g.capy.group.position.toArray().map(v => +v.toFixed(1)),
      yaw: +g.capy.group.rotation.y.toFixed(2), camYaw: +g.input.camYaw.toFixed(2), emis: emis.slice(0, 20), emisN: emis.length, bounce: g.bounceAudit(),
      info: Object.assign({}, g.camInfo), err: g.state.lastError || null }
  })
  await page.screenshot({ path: 'qa/l7-e4-scout-hk.png' })
  await page.waitForTimeout(12000)
  out.hkRest = await page.evaluate(() => { const g = window.__capy; return { cam: g.camera.position.toArray().map(v => +v.toFixed(1)), info: Object.assign({}, g.camInfo) } })
  await page.screenshot({ path: 'qa/l7-e4-scout-hk-rest.png' })
  await page.evaluate((o) => fetch('/shot?name=l7-e4-scout.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
