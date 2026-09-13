async page => {
  const state = async () => page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.body.position
    const cq = g.camera.quaternion
    const f = { x: -(2 * (cq.x * cq.z + cq.w * cq.y)), z: -(1 - 2 * (cq.x * cq.x + cq.y * cq.y)) }
    const n = Math.hypot(f.x, f.z) || 1
    return { pos: [p.x, p.y, p.z].map(v => +v.toFixed(2)), f: [f.x / n, f.z / n], swim: !!(g.capy.swimming || g.capy.inWater || g.capy.wet) }
  })
  const target = { x: -16, z: -16 }
  const log = []
  for (let i = 0; i < 9; i++) {
    const s = await state()
    const dx = target.x - s.pos[0], dz = target.z - s.pos[2]
    const d = Math.hypot(dx, dz)
    if (d < 2) break
    const ux = dx / d, uz = dz / d
    const fwd = s.f
    const right = [-fwd[1], fwd[0]]
    const cands = { KeyW: fwd, KeyS: [-fwd[0], -fwd[1]], KeyD: right, KeyA: [-right[0], -right[1]] }
    let best = 'KeyW', bd = -2
    for (const k in cands) { const dot = cands[k][0] * ux + cands[k][1] * uz; if (dot > bd) { bd = dot; best = k } }
    log.push([i, s.pos, +d.toFixed(1), best, +bd.toFixed(2), s.swim])
    await page.keyboard.down(best); await page.waitForTimeout(1200); await page.keyboard.up(best)
    await page.waitForTimeout(150)
    if (i === 4) await page.screenshot({ path: 'qa/l7r-play-31.png' })
  }
  await page.screenshot({ path: 'qa/l7r-play-32.png' })
  log.push(['end', await state()])
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s17.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
