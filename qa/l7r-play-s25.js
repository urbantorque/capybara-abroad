async page => {
  const state = async () => page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.body.position
    const cq = g.camera.quaternion
    const f = { x: -(2 * (cq.x * cq.z + cq.w * cq.y)), z: -(1 - 2 * (cq.x * cq.x + cq.y * cq.y)) }
    const n = Math.hypot(f.x, f.z) || 1
    return { pos: [p.x, p.y, p.z].map(v => +v.toFixed(2)), f: [f.x / n, f.z / n] }
  })
  const target = { x: -4, z: 34 }
  const log = []
  for (let i = 0; i < 12; i++) {
    const s = await state()
    const dx = target.x - s.pos[0], dz = target.z - s.pos[2]
    const d = Math.hypot(dx, dz)
    if (d < 2.5 || s.pos[1] < 0) break
    const ux = dx / d, uz = dz / d
    const fwd = s.f
    const right = [-fwd[1], fwd[0]]
    const cands = { KeyW: fwd, KeyS: [-fwd[0], -fwd[1]], KeyD: right, KeyA: [-right[0], -right[1]] }
    let best = 'KeyW', bd = -2
    for (const k in cands) { const dot = cands[k][0] * ux + cands[k][1] * uz; if (dot > bd) { bd = dot; best = k } }
    log.push([i, s.pos, +d.toFixed(1), best])
    await page.keyboard.down(best); await page.waitForTimeout(best === 'KeyW' ? 1500 : 900); await page.keyboard.up(best)
    await page.waitForTimeout(150)
    if (i === 5) await page.screenshot({ path: 'qa/l7r-play-49.png' })
  }
  await page.screenshot({ path: 'qa/l7r-play-50.png' })
  log.push(['end', await state()])
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s25.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), log)
}
