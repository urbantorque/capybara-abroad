async page => {
  // ---------------------------------------------------------------------------
  // qa/b15-shots.js — THE POSTER, JUDGED BY EYE
  //
  // Two questions a number cannot answer: does a board with a brown blob and
  // three grey bars on it READ as a wanted poster, and is it standing on the
  // floor. Four chapters, four grounds — a piazza, a beach, a cave floor and
  // an ice shelf — because "on the floor" is a different question in each.
  //
  // The capybara is put in front of it and the shot is framed on the poster,
  // so the thing being judged is the thing in the middle of the picture.
  // ---------------------------------------------------------------------------
  const shot = async (name) => {
    await page.waitForTimeout(1400)
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)
  await page.evaluate(() => { window.__capy.hud.forceNoto(20, 6, 8, 0, 0) })

  const rows = []
  for (const b of ['sahara', 'goreme', 'cave', 'venice']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(12000)
    const info = await page.evaluate((n) => {
      const g = window.__capy
      const p = (g.props || []).find(x => x && x.type === 'poster' && !x.removed &&
                                          x.biome === g.biome.current)
      if (!p) return { err: 'no poster in ' + n }
      // Stand 2.4 m in front of the poster's face, then frame ON it.
      const yaw = p.mesh ? p.mesh.rotation.y : 0
      const fx = p.body.position.x + Math.sin(yaw) * 2.4
      const fz = p.body.position.z + Math.cos(yaw) * 2.4
      g.capy.body.position.set(fx, p.body.position.y + 0.6, fz)
      g.capy.body.velocity.set(0, 0, 0)
      return { b: n, x: +p.body.position.x.toFixed(1), y: +p.body.position.y.toFixed(2),
               z: +p.body.position.z.toFixed(1),
               // the capybara's own y once it has settled is the floor here
               capyY: +g.capy.position.y.toFixed(2) }
    }, b)
    await page.waitForTimeout(3000)
    const settled = await page.evaluate(() => {
      const g = window.__capy
      const p = (g.props || []).find(x => x && x.type === 'poster' && !x.removed &&
                                          x.biome === g.biome.current)
      const cp = g.capy.position
      // FRAME IT. `yaw` in frameShot is the bearing from the subject to the
      // CAMERA — B11's sit shot was caught by this and so was the first cut of
      // this one, in the opposite direction: the animal was stood in FRONT of
      // the poster and then the camera was put on its far side, which is to
      // say behind the lens. Marrakech and Cappadocia came back as
      // photographs of a souk and a carpet stall. The camera goes on the
      // POSTER'S side, so the animal is between the two of them.
      if (p) {
        const dx = p.body.position.x - cp.x, dz = p.body.position.z - cp.z
        const d = Math.hypot(dx, dz) || 1
        g.frameShot({ yaw: Math.atan2(dx / d, dz / d), dist: 5.2, pitch: 0.06,
                      raise: 0.5, hold: 4 })
      }
      return { posterY: p ? +p.body.position.y.toFixed(2) : null,
               capyY: +cp.y.toFixed(2),
               gap: p ? +(p.body.position.y - cp.y).toFixed(2) : null,
               d: p ? +Math.hypot(cp.x - p.body.position.x,
                                  cp.z - p.body.position.z).toFixed(1) : null }
    })
    rows.push(Object.assign({}, info, settled))
    await shot('b15-poster-' + b + '.png')
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=b15-shots.json', { method: 'POST', body: s })
  }, { rows: rows })
}
