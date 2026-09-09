async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 180)))
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(7000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('sahara')
    const sp = g.biome.spawnOf('sahara'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const sa = g.sahara
    const o = {}
    o.spawn = { x: +sp.x.toFixed(1), y: +sp.y.toFixed(1), z: +sp.z.toFixed(1) }
    const pt = v => v ? { x: +(v.x !== undefined ? v.x : v.position.x).toFixed(1), z: +(v.z !== undefined ? v.z : v.position.z).toFixed(1) } : null
    o.anchors = {
      cart: pt(sa.cart), basket: pt(sa.basket), gate: pt(sa.gate), koutoubia: pt(sa.koutoubia),
      camp: pt(sa.camp), duneTop: pt(sa.duneTop), souk: pt(sa.souk),
      datePalm: pt(sa.datePalm), caravan: pt(sa.caravan && sa.caravan()),
      acrobatMat: pt(sa.acrobatMat && sa.acrobatMat())
    }
    // locals
    const L = g.locals.filter(r => r.biome === 'sahara')
    o.locals = L.map(r => ({ x: +r.x.toFixed(0), z: +r.z.toFixed(0), near: r.near,
      fig: !!r.fig, lines: (r.lines || []).length, praise: (r.praise || []).length,
      onTask: r.onTask ? Object.keys(r.onTask).length : 0,
      greet: !!(r.greet || r.unprompted || r.hail) }))
    // critters
    o.critters = (g.critters || []).filter(c => c.biome === 'sahara').map(c => ({ r: c.r, bold: c.bold }))
    o.critterTotal = (g.critters || []).length
    // exchanges
    o.exchanges = (g.exchanges || []).filter(e => e.biome === 'sahara').length
    // props
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === 'sahara'))
    o.props = props.map(p => ({ n: p.name || p.kind || '?', m: p.mass, edible: !!p.edible,
      owner: !!p.owner, keep: !!p.keep, x: +p.body.position.x.toFixed(0), z: +p.body.position.z.toFixed(0) }))
    // surface pitch samples via the ladder's zone questions
    o.zones = {}
    const probe = [['spawn', sp.x, sp.z], ['cart', sa.cart.x, sa.cart.z], ['souk', sa.souk.x, sa.souk.z],
      ['gate', sa.gate.x, sa.gate.z], ['camp', sa.camp.x, sa.camp.z], ['duneTop', sa.duneTop.x, sa.duneTop.z],
      ['palm', sa.datePalm.x, sa.datePalm.z]]
    for (const [n, x, z] of probe) {
      o.zones[n] = ['square', 'souk', 'medina', 'palmeraie', 'erg', 'dune', 'camp'].filter(k => sa.inZone(k, x, z))
    }
    o.mood = !!(g.hud && g.hud.mood)
    o.tasks = (g.tasks || []).filter(t => t.chapter === 8).map(t => t.id)
    return o
  })
  out.errs = errs.slice(0, 8)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=b3sah-a.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
