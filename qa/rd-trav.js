async page => {
  // rd-trav.js — the last line of the traveller's arc.
  //
  // Three questions, and the second is the one that would be a bug shipped to
  // every chapter: does one appear on the lawn, does it GO AWAY when the
  // chapter changes (it is built outside a build, so nothing else will ever
  // take it off), and does a second staging make a second one.
  const shot = async (name) => {
    const b = await page.screenshot({ type: 'png' })
    await page.evaluate(async (o) => {
      await fetch('/shot?name=' + o.n, { method: 'POST', body: o.b })
    }, { n: name, b: b.toString('base64') })
  }
  const out = {}
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(3000)
  out.started = await page.evaluate(() => window.__capy.state.started)

  // Count travellers by their fixed palette: THE TRAVELLER is the only figure
  // in the game wearing that shirt with that hat, which is the whole premise
  // of npcTRAV_FIG. Counting by position instead would miss a duplicate
  // standing in exactly the same place, which is the failure being looked for.
  const look = () => page.evaluate(() => {
    const g = window.__capy
    const out = []
    g.scene.traverse((o) => {
      if (!o.isGroup) return
      // the lawn ring, generously
      const dx = o.position.x - 30, dz = o.position.z - 26
      const d = Math.hypot(dx, dz)
      if (d > 1 && d < 12 && Math.abs(o.position.y) < 3 && o.children.length > 2) {
        let vis = true
        for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break }
        out.push({ x: +o.position.x.toFixed(2), y: +o.position.y.toFixed(2),
                   z: +o.position.z.toFixed(2), d: +d.toFixed(2),
                   vis: vis, own: o.visible, kids: o.children.length })
      }
    })
    return { cur: g.biome.current, groups: out, err: g.state.lastError || null }
  })

  out.beforeStage = await look()
  // Put the animal in the middle of the horseshoe and stage it.
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(30, 1.2, 26)
    g.capy.body.velocity.set(0, 0, 0)
    g.events.emit('finale:staged', {})
  })
  await page.waitForTimeout(4000)
  out.afterStage = await look()
  await shot('trav-lawn')

  // ...and away, which is the part that would otherwise put a man with a
  // rucksack at Sydney's coordinates in the middle of the Sahara.
  await page.evaluate(() => { window.__capy.hud.cross('sahara') })
  await page.waitForTimeout(8000)
  out.inSahara = await look()
  await shot('trav-sahara')

  // ...and back, staged a second time. One traveller, not two.
  await page.evaluate(() => { window.__capy.hud.cross('sydney') })
  await page.waitForTimeout(8000)
  await page.evaluate(() => {
    const g = window.__capy
    g.capy.body.position.set(30, 1.2, 26)
    g.capy.body.velocity.set(0, 0, 0)
    g.events.emit('finale:staged', {})
  })
  await page.waitForTimeout(4500)
  out.secondStage = await look()
  await shot('trav-again')

  await page.evaluate(async (o) => {
    await fetch('/shot?name=rd-trav.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
