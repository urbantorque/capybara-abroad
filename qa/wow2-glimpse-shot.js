async page => {
  const out = {}
  out.pos = await page.evaluate(async () => {
    const g = window.__capy
    const board = g.exitBoard()
    let gr = null
    for (const l of g.locals) if (l.trav && l.gateChap && l.biome === 'kyoto') gr = l
    if (!gr) return { found: false }
    // Stand the capybara 8 m from the board, camera looking at both.
    const dx = board.x - gr.group.position.x, dz = board.z - gr.group.position.z
    const capy = g.capy
    capy.position.x = board.x - 8
    capy.position.z = board.z
    if (capy.body) { capy.body.position.x = capy.position.x; capy.body.position.z = capy.position.z }
    for (let i = 0; i < 20; i++) g.tick(1 / 60, false)
    g.tick(1 / 60, true)
    return { found: true, gSt: gr.gSt, capy: { x: capy.position.x, z: capy.position.z },
             fig: { x: gr.group.position.x, y: gr.group.position.y, z: gr.group.position.z, visible: gr.group.visible } }
  })
  await page.screenshot({ path: 'qa/wow2-glimpse-read.png' })
  await page.evaluate((o) => {
    const enc = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    fetch('/shot?name=wow2-glimpse-shot', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: enc })
  }, out)
}
