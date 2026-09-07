async page => {
  // ---------------------------------------------------------------------------
  // qa/nudge-coast.js — IS IT A PUSH, OR IS IT A BULLDOZER? (item 4c)
  //
  // The first pass measured a ball, a hat and a picnic basket all moving 5.33,
  // 5.29 and 5.33 m when walked into — three different shapes and masses
  // agreeing to four centimetres, which is not physics. That is the animal
  // shoving the thing along in front of it for the whole walk.
  //
  // 4c asks for "a steady push so a ball ROLLS", and rolling is what happens
  // AFTER you stop. So the walk is 0.8 s and then the key comes up, and the
  // prop's position is taken at that moment and again two seconds later:
  //
  //     carry = how far it went while it was being leaned on
  //     coast = how far it went once nobody was touching it
  //
  // A bulldozer has a coast of zero.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(11000)

  await page.evaluate(() => {
    const p = window.__capy.capy.position
    window.__home = { x: p.x, y: p.y, z: p.z }
  })
  const home = async () => page.evaluate(() => {
    const g = window.__capy, h = window.__home
    g.capy.body.position.set(h.x, h.y + 0.4, h.z)
    g.capy.body.velocity.set(0, 0, 0)
    g.capy.body.previousPosition.copy(g.capy.body.position)
    g.capy.body.interpolatedPosition.copy(g.capy.body.position)
  })

  const rows = []
  // THREE PASSES EACH. One pass gave a beach ball a coast of 4.37 m and the
  // next gave it 0.37 — a twelve-fold swing with nothing changed, because the
  // contact geometry (dead centre or a glancing shoulder, on the ground or
  // airborne) is different every time the animal walks into something. A single
  // before/after pair off this instrument is not evidence; see
  // capy3-instruments-that-cannot-hold-a-line.
  const PASSES = [0, 1, 2]
  for (const pass of PASSES)
  for (const t of ['ball', 'cone', 'bin']) {
    await home()
    await page.waitForTimeout(1500)
    const put = await page.evaluate((a) => {
      const g = window.__capy
      const cp = g.capy.position
      const yaw = g.input.camYaw
      const px = cp.x - Math.sin(yaw) * 2.6, pz = cp.z - Math.cos(yaw) * 2.6
      const pr = g.physics.spawnProp(a.t, px, pz, cp.y)
      if (!pr) return { err: 'no prop' }
      window.__p = pr
      return { ok: true }
    }, { t: t })
    if (put.err) { rows.push({ t: t, err: put.err }); continue }
    await page.waitForTimeout(1400)              // let it land and settle
    const p0 = await page.evaluate(() => {
      const p = window.__p
      const g = window.__capy
      return { x: p.body.position.x, z: p.body.position.z,
               gap: +Math.hypot(p.body.position.x - g.capy.position.x,
                                p.body.position.z - g.capy.position.z).toFixed(2) }
    })
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(800)
    await page.keyboard.up('KeyW')
    const p1 = await page.evaluate(() => {
      const p = window.__p, g = window.__capy
      const v = g.capy.velocity
      return { x: p.body.position.x, z: p.body.position.z,
               capySpeed: +Math.hypot(v.x, v.z).toFixed(2),
               propSpeed: +Math.hypot(p.body.velocity.x, p.body.velocity.z).toFixed(2) }
    })
    // THE SPEED TRACE. `coast` came back at 0.29 m against a prop that read
    // 5.0 m/s on the frame the key came up, and 5 m/s at mu 0.22 and g 24 is a
    // 2.4 m slide. One of those two numbers is a lie and only a trace says
    // which — a single sample at each end of a window cannot tell a prop that
    // never had the speed from one that lost it instantly (trap 38).
    const trace = await page.evaluate(async () => {
      const p = window.__p, out = []
      for (let i = 0; i < 12; i++) {
        out.push(+Math.hypot(p.body.velocity.x, p.body.velocity.z).toFixed(2))
        await new Promise(r => setTimeout(r, 100))
      }
      return out
    })
    await page.waitForTimeout(1300)
    rows.push(await page.evaluate((a) => {
      const p = window.__p
      const carry = Math.hypot(a.p1.x - a.p0.x, a.p1.z - a.p0.z)
      const coast = Math.hypot(p.body.position.x - a.p1.x, p.body.position.z - a.p1.z)
      const r = { t: a.t, pass: a.pass, mass: p.body.mass, gap0: a.p0.gap,
                  capySpeed: a.p1.capySpeed, propSpeed: a.p1.propSpeed,
                  carry: +carry.toFixed(2), coast: +coast.toFixed(2), trace: a.tr }
      window.__capy.physics.removeProp(p)
      return r
    }, { t: t, pass: pass, p0: p0, p1: p1, tr: trace }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=nudge-coast.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
