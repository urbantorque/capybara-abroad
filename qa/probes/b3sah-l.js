async page => {
  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const b = g.capy.body, sa = g.sahara
    const rows = [], bad = []
    let n = 0, jam = 0
    for (let z = -12; z <= 20; z += 4) {
      let row = ''
      for (let x = -20; x <= 24; x += 4) {
        const y = sa.terrainHeight(x, z) + 1.0
        b.position.set(x, y, z); b.velocity.set(0, 0, 0)
        b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
        for (let i = 0; i < 100; i++) { g.input.x = 0; g.input.z = 0; g.tick(1 / 60, false)
          b.position.set(x, y, z); b.velocity.set(0, 0, 0)
          b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position) }
        const d = Math.hypot(g.camera.position.x - x, g.camera.position.z - z)
        n++
        row += d < 3 ? '#' : (d < 6 ? '-' : '.')
        if (d < 3) { jam++; bad.push([x, z, +d.toFixed(1)]) }
      }
      rows.push('z=' + String(z).padStart(3) + ' ' + row)
    }
    return { rows, n, jam, bad: bad.slice(0, 24), legend: 'x -20..24 step 4; # cam<3m  - <6m  . ok' }
  })
  await page.evaluate(async (o) => { await fetch('/shot?name=b3sah-l.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
