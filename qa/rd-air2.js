async page => {
  // rd-air2.js — as rd-air, with the two confounds removed.
  //
  //  1. `gull` builds a five-deep formant stack of its own, so counting
  //     biquads counted the synth. `pop` is a sine and a gain and nothing else,
  //     so any biquad in a `pop` call came from the routing block.
  //  2. the per-name throttle was swallowing most of the calls; force: true.
  //
  // And it reports audioProbe beside the filter, so "the back cue closed it,
  // not the air" is a distinguishable answer rather than a guess.
  const out = {}
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  await page.evaluate(() => {
    const proto = (window.BaseAudioContext || window.AudioContext).prototype
    window.__lp = []
    const raw = proto.createBiquadFilter
    proto.createBiquadFilter = function () {
      const f = raw.call(this)
      window.__lp.push(f)
      return f
    }
  })

  const at = async (dd, behind) => page.evaluate((o) => {
    const g = window.__capy
    window.__lp.length = 0
    const cam = g.camera
    cam.updateMatrixWorld(true)
    const e = cam.matrixWorld.elements
    let fx = -e[8], fz = -e[10]
    const fl = Math.hypot(fx, fz) || 1
    fx /= fl; fz /= fl
    if (o.behind) { fx = -fx; fz = -fz }
    const c = g.capy.position
    const p = { x: c.x + fx * o.d, y: c.y + 0.4, z: c.z + fz * o.d }
    const probe = g.hud.audioProbe ? g.hud.audioProbe(p.x, p.y, p.z) : null
    g.sfx('pop', { at: p, far: 400, force: true })
    return { d: o.d, behind: !!o.behind,
             n: window.__lp.length,
             hz: window.__lp.map(f => Math.round(f.frequency.value)),
             type: window.__lp.map(f => f.type),
             probe: probe }
  }, { d: dd, behind: behind })

  out.front = []
  for (const d of [2, 6, 9, 14, 20, 35, 55, 80, 150]) {
    out.front.push(await at(d, false))
    await page.waitForTimeout(260)
  }
  out.behind = []
  for (const d of [6, 20, 80]) {
    out.behind.push(await at(d, true))
    await page.waitForTimeout(260)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-air2.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
