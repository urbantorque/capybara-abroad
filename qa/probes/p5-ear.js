async page => {
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  // The ear pose is not published, so it is read off the SCENE GRAPH: find the
  // two ear groups by their known local offsets under the capybara's head.
  // Anything published for the sake of a probe can drift from what is drawn;
  // the node cannot.
  out.ear = await page.evaluate(async () => {
    const g = window.__capy
    let head = null
    g.scene.traverse((o) => {
      if (head) return
      // the head carries a nose pad at z 0.4858 and two ear groups at x +-0.135
      let ears = 0, pad = false
      for (const c of o.children || []) {
        if (Math.abs(Math.abs(c.position.x) - 0.135) < 1e-6 && Math.abs(c.position.y - 0.17) < 1e-6) ears++
        if (Math.abs(c.position.z - 0.4858) < 1e-6) pad = true
      }
      if (ears === 2 && pad) head = o
    })
    if (!head) return { noHead: true }
    const E = head.children.filter(c => Math.abs(Math.abs(c.position.x) - 0.135) < 1e-6)
    const read = () => ({ ly: Math.round(E[0].rotation.y * 1000) / 1000,
                          ry: Math.round(E[1].rotation.y * 1000) / 1000 })
    const rest = read()
    // a person startled 8 m off the animal's LEFT, then 8 m off its RIGHT
    const rec = { group: { position: { x: 0, y: 0, z: 0 } } }
    const p = g.capy.position
    const my = (g.capy.model || { rotation: { y: 0 } }).rotation.y
    const shot = async (side) => {
      // side +1 = to the animal's right (its +x in its own frame)
      rec.group.position.x = p.x + Math.cos(my) * 8 * side
      rec.group.position.z = p.z - Math.sin(my) * 8 * side
      rec.group.position.y = p.y
      g.events.emit('npc:startled', { npc: rec })
      await new Promise(r => setTimeout(r, 130))
      const v = read()
      await new Promise(r => setTimeout(r, 3500))     // let it decay right off
      return v
    }
    const right = await shot(1)
    const left = await shot(-1)
    // ...and a person 40 m away, which is out of earshot and must do nothing
    rec.group.position.x = p.x + 40; rec.group.position.z = p.z
    g.events.emit('npc:startled', { npc: rec })
    await new Promise(r => setTimeout(r, 130))
    const far = read()
    return { rest: rest, right: right, left: left, far: far }
  })

  // ...and the sniff, which is on a clock: sample the nose pad scale
  out.sniff = await page.evaluate(async () => {
    const g = window.__capy
    let pad = null
    g.scene.traverse((o) => {
      if (!pad && o.isMesh && Math.abs(o.position.z - 0.4858) < 1e-6) pad = o
    })
    if (!pad) return { noPad: true }
    let mx = 0, mn = 9, n = 0
    for (let i = 0; i < 220; i++) {
      await new Promise(r => setTimeout(r, 60))
      const s = pad.scale.x
      if (s > mx) mx = s
      if (s < mn) mn = s
      if (s > 1.02) n++
    }
    return { max: Math.round(mx * 1000) / 1000, min: Math.round(mn * 1000) / 1000, frames: n }
  })

  out.errs = errs
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=p5-ear.json', { method: 'POST', body: s })
  }, out)
}
