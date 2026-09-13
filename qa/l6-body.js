async page => {
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5500)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6500)
  const out = { started: await page.evaluate(() => window.__capy.state.started) }

  // THE SFX TAP. game.sfx is a property on the game object and capybara.js
  // calls it through the object, so a wrapper sees every name the animal asks
  // for — before the audio gates, which in a headless run are all shut.
  await page.evaluate(() => {
    const g = window.__capy
    window.__sfx = { n: {}, log: [] }
    const orig = g.sfx
    g.sfx = function (name, opts) {
      window.__sfx.n[name] = (window.__sfx.n[name] || 0) + 1
      window.__sfx.log.push({ name, t: g.state.time, tick: window.__tickN || 0 })
      return orig.call(this, name, opts)
    }
  })

  // THE 60 Hz DRIVE. The headless GPU renders at ~15 fps, so a real-time
  // key press would put the whole armed crouch inside one frame. Every
  // sequence below is stepped with game.tick(1/60, false) and the stick is
  // re-asserted every tick (systems.js rewrites game.input at the bottom of
  // its own update — mv-feel's idiom). animAudit is sampled after each tick.
  const seq = (label, plan) => page.evaluate(({ label, plan }) => {
    const g = window.__capy, inp = g.input, D = 1 / 60
    const b = g.capy.body
    const rows = []
    let tick = 0
    const place = (x, z) => {
      const y = g.env.terrainHeight ? g.env.terrainHeight(x, z) : 0
      b.position.set(x, y + 0.5, z); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0)
      b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    }
    const T = (k, s) => {
      s = s || {}
      for (let i = 0; i < k; i++) {
        inp.x = s.x || 0; inp.z = s.z || 0; inp.run = !!s.run; inp.camYaw = 0
        inp.jump = !!s.jump; inp.jumpPressed = !!(s.jumpEdge && i === 0)
        inp.honkPressed = !!(s.honk && i === 0)
        inp.action = !!s.action; inp.actionPressed = !!(s.actionEdge && i === 0)
        window.__tickN = ++tick
        g.tick(D, false)
        const a = g.capy.animAudit()
        rows.push({ k: tick, t: +(tick * D).toFixed(4), y: +b.position.y.toFixed(3), gr: a.grounded ? 1 : 0,
          vy: +a.vy.toFixed(2), pop: +a.pop.toFixed(3), sqY: +a.sqY.toFixed(3), pitch: +a.pitch.toFixed(3),
          airP: +a.airPitch.toFixed(3), headX: +a.headX.toFixed(3), earX: +(g.capy.animAudit().earZ).toFixed(3),
          arm: +a.hopArm.toFixed(3), hold: +a.landHold.toFixed(3), lunge: +a.lungeW.toFixed(3),
          lz: +a.lungeZ.toFixed(3), inh: +a.inhaleW.toFixed(3), leg0: +a.legX[0].toFixed(3),
          lean: +a.lean.toFixed(3), speed: +a.speed.toFixed(2), swim: g.capy.swimming ? 1 : 0,
          nap: +(a.nap || 0).toFixed(2), loaf: +(a.loaf || 0).toFixed(2), hs: +a.headScale.toFixed(3) })
      }
    }
    window.__sfx.log.length = 0
    const s0 = Object.assign({}, window.__sfx.n)
    for (const step of plan) {
      if (step.place) place(step.place[0], step.place[1])
      if (step.spawn) g.physics.spawnProp(step.spawn[0], step.spawn[1], step.spawn[2])
      if (step.k) T(step.k, step)
    }
    const s1 = window.__sfx.n
    const fired = {}
    for (const k in s1) if ((s1[k] || 0) - (s0[k] || 0) > 0) fired[k] = s1[k] - (s0[k] || 0)
    return { label, rows, fired, log: window.__sfx.log.slice(), err: g.state.lastError }
  }, { label, plan })

  // A flat, dry patch of Sydney: the lawn north of the spawn (mv-feel uses
  // the spawn ring; this is the same lawn).
  const LAWN = [6, 30]
  // 1. THE STANDING JUMP: 100 ms of Space (six ticks), the way a finger does it.
  out.jump = await seq('jump', [
    { place: LAWN }, { k: 60 },
    { k: 6, jump: true, jumpEdge: true }, { k: 90 }])
  // 2. THE RUNNING JUMP: S+shift (south is the open run off this lawn —
  // measured: 7.4 m/s for 14 m with no contact) for 1.5 s, then Space held
  // six ticks, the stick kept.
  out.runjump = await seq('runjump', [
    { place: LAWN }, { k: 30 }, { k: 90, z: 1, run: true },
    { k: 6, z: 1, run: true, jump: true, jumpEdge: true }, { k: 90, z: 1, run: true }, { k: 40 }])
  // 3. THE WHEEK: settled, then Q.
  out.wheek = await seq('wheek', [
    { place: LAWN }, { k: 90 }, { k: 1, honk: true }, { k: 80 }])
  // 4. THE GRAB, AND THE CHEW: a sandwich put down under the nose (the
  // animal faces +z at rest), E tapped — a real grab, not a whiff, because a
  // tap of E on grass with nothing in reach is the first frame of a dig —
  // and then six seconds of standing still with it, which is four bites.
  out.grab = await seq('grab', [
    { place: LAWN }, { spawn: ['sandwich', 6, 30.9] }, { k: 60 },
    { k: 3, action: true, actionEdge: true }, { k: 80 }, { k: 360 }])
  // 5. THE STOP: a two-second run, then the stick let go.
  out.stop = await seq('stop', [
    { place: LAWN }, { k: 30 }, { k: 120, z: 1, run: true }, { k: 70 }])
  // 6. THE SWIM AND THE SHAKE: into the harbour (z < -10 is water in Sydney),
  // two seconds of paddling, hauled out onto the lawn, and stood still.
  out.shake = await seq('shake', [
    { place: [25, -22] }, { k: 150, z: -1 }, { place: [25, -4] }, { k: 20 }, { k: 200 }])
  // 8. THE NAP: 36 s of nothing at 60 Hz — the loaf at 6.5 s, the nap at 26.
  out.nap = await seq('nap', [
    { place: LAWN }, { k: 60 }, { k: 2160 }])

  // ---- REAL TIME: the rest lens and the pictures -------------------------
  // The rest rig opens on wall-clock stillness (restIdleT), so this part is
  // not tick-driven. Standing still 24 s, then the face-visibility dot.
  await page.evaluate(() => { const g = window.__capy; const b = g.capy.body; const y = g.env.terrainHeight ? g.env.terrainHeight(6, 30) : 0; b.position.set(6, y + 0.5, 30); b.velocity.set(0, 0, 0) })
  // HELD, not pressed: at ~15 fps a press() is down and up inside one frame
  // and the key poll never sees it (harness trap: the stick that clears
  // restBlocked has to be seen by a frame)
  await page.keyboard.down('KeyW'); await page.waitForTimeout(250); await page.keyboard.up('KeyW'); await page.waitForTimeout(300)
  // dot(nose, head -> lens): column 2 of the head's world matrix is its local
  // +z (the nose), column 3 is where it is
  await page.evaluate(() => {
    const g = window.__capy
    window.__face = () => {
      const head = g.capy.group.getObjectByName('capyMuzzle').parent
      head.updateWorldMatrix(true, false)
      const e = head.matrixWorld.elements
      let fx = e[8], fy = e[9], fz = e[10]; const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl
      const c = g.camera.position
      let tx = c.x - e[12], ty = c.y - e[13], tz = c.z - e[14]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl
      const ci = g.camInfo
      return { t: +g.state.time.toFixed(1), dot: +(fx * tx + fy * ty + fz * tz).toFixed(3), camDist: +ci.dist.toFixed(2), rest: +ci.rest.toFixed(3),
               headScale: +head.scale.x.toFixed(3), headYaw: +head.rotation.y.toFixed(3), loaf: +g.capy.loaf.toFixed(2), nap: +g.capy.nap.toFixed(2) }
    }
  })
  // sixty seconds of rest, sampled four times a second: the share of frames
  // with the face toward the lens (dot > 0.2) is the roadmap's number
  const samples = []
  let shot = false
  for (let i = 0; i < 240; i++) {
    await page.waitForTimeout(250)
    const s = await page.evaluate(() => window.__face())
    samples.push(s)
    if (!shot && i >= 80 && s.rest >= 0.75) { await page.screenshot({ path: 'qa/l6-body-rest.png' }); shot = true; out.restShotAt = s }
  }
  if (!shot) { await page.screenshot({ path: 'qa/l6-body-rest.png' }); out.restShotAt = samples[samples.length - 1] }
  const open = samples.filter(s => s.rest >= 0.45)
  out.rest = { samples: samples.length, openN: open.length, faceOpenPct: open.length ? +(100 * open.filter(s => s.dot > 0.2).length / open.length).toFixed(0) : 0,
               faceAllPct: +(100 * samples.filter(s => s.dot > 0.2).length / samples.length).toFixed(0),
               dotMax: Math.max(...samples.map(s => s.dot)), last: samples[samples.length - 1], every5s: samples.filter((s, i) => i % 20 === 0) }
  // ...and the air: a real Space, and the frame nearest the apex
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD'); await page.waitForTimeout(400)
  await page.keyboard.down('Space'); await page.waitForTimeout(150); await page.keyboard.up('Space'); await page.waitForTimeout(250)
  out.air = await page.evaluate(() => { const a = window.__capy.capy.animAudit(); return { airP: +a.airPitch.toFixed(3), pitch: +a.pitch.toFixed(3), vy: +a.vy.toFixed(2), gr: a.grounded ? 1 : 0 } })
  await page.screenshot({ path: 'qa/l6-body-air.png' })
  out.lastError = await page.evaluate(() => window.__capy.state.lastError)
  await page.evaluate((o) => fetch('/shot?name=l6-body.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
