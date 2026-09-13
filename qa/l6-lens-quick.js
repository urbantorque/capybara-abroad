async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.addInitScript(() => { try { localStorage.setItem('capy3.prefs.v1', JSON.stringify({ v: 1, pf: 1 })) } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(7000)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(3500)
  const r = await page.evaluate(() => {
    const g = window.__capy
    const suns = []; g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) suns.push(o) })
    let big = 0, casters = 0
    g.scene.traverse(o => { if (o.isMesh && o.castShadow) { casters++; if (o.layers.isEnabled(7)) big++ } })
    return { started: g.state.started, err: g.state.lastError, suns: suns.map(s => ({ i: +s.intensity.toFixed(2), si: s.shadow.intensity, map: !!s.shadow.map, near: s.shadow.camera.near, far: s.shadow.camera.far, left: s.shadow.camera.left })), casters, big, sunTotal: g.state.sunTotal, rung: g.perfAudit().rung }
  })
  console.log(JSON.stringify(r))
  await page.screenshot({ path: 'qa/l6-lens-quick.png' })
  await page.keyboard.up('KeyW')
  await page.evaluate((o) => fetch('/shot?name=l6-lens-quick.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r)
}
