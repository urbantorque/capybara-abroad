async page => {
  const out = {}
  out.leave = await page.evaluate(async () => {
    const g = window.__capy
    const board = g.exitBoard()
    const capy = g.capy
    const steps = []
    for (let i = 0; i < 600; i++) {
      const sdx = board.x - capy.position.x, sdz = board.z - capy.position.z
      const sd = Math.hypot(sdx, sdz) || 1
      // keep walking toward the board itself now, past the 6 m leave ring
      const step = Math.min(sd, 2.0 / 60)
      if (sd > 3) {
        capy.position.x += (sdx / sd) * step
        capy.position.z += (sdz / sd) * step
        if (capy.body) { capy.body.position.x = capy.position.x; capy.body.position.z = capy.position.z }
      }
      g.tick(1 / 60, false)
      if (i % 30 === 0) {
        let gr = null
        for (const l of g.locals) if (l.trav && l.gateChap && l.biome === 'kyoto') gr = l
        steps.push({ i, capyD: sd, gSt: gr ? gr.gSt : null, visible: gr && gr.group ? gr.group.visible : null })
      }
    }
    let gr = null
    for (const l of g.locals) if (l.trav && l.gateChap && l.biome === 'kyoto') gr = l
    return { steps, finalGSt: gr ? gr.gSt : null, finalVisible: gr && gr.group ? gr.group.visible : null }
  })
  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-glimpse-leave', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
