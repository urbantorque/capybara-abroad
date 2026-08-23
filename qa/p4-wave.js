async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('manly')
    const b = g.capy.body
    b.position.set(0, 3.2, 46); b.velocity.set(0,0,0)
    for (let i=0;i<60;i++) g.tick(1/60,false)
    const rows = []
    for (let s = 0; s < 26; s++) {
      for (let i=0;i<180;i++) g.tick(1/60,false)   // 3 s
      let line = ''
      let maxFoam = 0, maxAmp = 0, maxBrk = 0
      for (let z = 26; z > -70; z -= 4) {
        const w = g.manly.wave(0, z)
        maxFoam = Math.max(maxFoam, w.foam); maxAmp = Math.max(maxAmp, w.amp); maxBrk = Math.max(maxBrk, w.brk)
        line += w.foam > 0.55 ? 'W' : w.foam > 0.2 ? 'w' : w.y > 0.35 ? '^' : w.y < -0.35 ? 'v' : '-'
      }
      rows.push({ t: (s+1)*3, line, foam: +maxFoam.toFixed(2), amp: +maxAmp.toFixed(2), brk: +maxBrk.toFixed(2),
                  setNear: +g.manly.setNear().toFixed(2) })
    }
    let spray = 0
    return { rows }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=p4wave.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
