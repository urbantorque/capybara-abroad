async page => {
  // The two costumes R6 touches, from the three bearings that show a collar.
  // Run once before the change and once after: the tag is a literal because
  // run-code takes no argument (harness trap 14).
  const TAG = 'after'
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const n = await page.evaluate(async (TAG) => {
    const g = window.__capy, T = g.THREE
    const W = 1000, H = 620
    g.renderer.setSize(W, H, false)
    const my = (g.capy.model || g.capy.group).rotation.y
    const p = g.capy.position
    const aim = new T.Vector3(p.x, p.y + 0.02, p.z)
    const counts = {}
    // NO TICK between wear() and a render: systems.js re-asserts the chapter's
    // costume every frame and one tick here photographs a naked animal.
    for (const id of ['black-tie', 'parka']) {
      g.capy.wear(id)
      let n = 0
      g.capy.group.traverse(o => {
        if (!o.isMesh || !o.visible) return
        for (let q = o.parent; q && q !== g.capy.group; q = q.parent) if (!q.visible) return
        n++
      })
      counts[id] = n
      // EVERY RENDER FIRST, THEN THE POSTS. An await yields to the event loop,
      // rAF runs, and systems.js re-asserts the chapter's costume - so the
      // first shot of a set came back dressed and the other two came back of a
      // naked capybara. The three data URLs are taken in one JS turn.
      const urls = []
      for (const v of [['front', 0.10, 1.5, 0.34], ['3q', 0.72, 1.5, 0.38],
                       ['side', Math.PI * 0.5, 1.6, 0.28]]) {
        const yaw = my + v[1]
        const c = new T.PerspectiveCamera(30, W / H, 0.02, 400)
        c.position.set(aim.x + Math.sin(yaw) * v[2], aim.y + v[3], aim.z + Math.cos(yaw) * v[2])
        c.lookAt(aim.x, aim.y, aim.z); c.updateMatrixWorld()
        g.renderer.render(g.scene, c)
        urls.push([v[0], g.renderer.domElement.toDataURL('image/png')])
      }
      for (const u of urls) {
        await fetch('/shot?name=R6w-' + TAG + '-' + id + '-' + u[0], { method: 'POST', body: u[1] })
      }
    }
    g.capy.wear(null)
    return counts
  }, TAG)

  await page.evaluate(async o => {
    await fetch('/shot?name=R6-wear.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { errs, counts: n })
}
