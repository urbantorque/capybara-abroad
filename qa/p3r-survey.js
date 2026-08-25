async page => {
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message.slice(0, 200)))
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(1000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  const out = await page.evaluate(async () => {
    const g = window.__capy
    g.biome.switchTo('rio')
    const sp = g.biome.spawnOf('rio'), b = g.capy.body
    b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 120; i++) g.tick(1 / 60, false)
    const r = g.rio
    const o = {}
    o.biome = g.biome.current
    o.spawn = { x: +sp.x.toFixed(1), y: +sp.y.toFixed(1), z: +sp.z.toFixed(1) }
    o.api = Object.keys(r).sort()
    // ---- tasks
    const T = (g.tasksOfChapter ? g.tasksOfChapter(6) : null)
    o.hasTasksOfChapter = !!g.tasksOfChapter
    o.taskIds = []
    try {
      const all = g.taskList ? g.taskList() : null
      if (all) o.taskIds = all.filter(t => t.chapter === 6).map(t => t.id + (t.wow ? '*WOW' : '') + (t.mini ? '*MINI' : '') + (t.act ? '*act' + t.act : ''))
    } catch (e) { o.taskErr = '' + e }
    o.gameKeys = Object.keys(g).filter(k => /task|act|card|hint/i.test(k))
    // ---- locals
    const L = g.locals.filter(x => x.biome === 'rio')
    o.locals = L.length
    o.walkers = L.filter(x => x.fig).length
    o.localDetail = L.map(x => ({
      x: +x.x.toFixed(1), z: +x.z.toFixed(1),
      near: x.near, lines: (x.lines || []).length,
      after: (x.lines || []).filter(l => l && l.after).length,
      before: (x.lines || []).filter(l => l && l.before).length,
      when: (x.lines || []).filter(l => l && l.when).length,
      wheek: (x.wheek || []).length,
      onTask: x.onTask ? Object.keys(x.onTask).length : 0,
      walk: !!x.fig
    }))
    // pairs within 13
    let pairs = 0, p13 = []
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const d = Math.hypot(L[i].x - L[j].x, L[i].z - L[j].z)
      if (d < 13) { pairs++; p13.push([i, j, +d.toFixed(1)]) }
    }
    o.pairs13 = pairs; o.pairList = p13
    // ---- props
    const P = g.props.filter(p => !p.removed && (!p.biome || p.biome === 'rio'))
    o.props = P.length
    o.propDetail = P.map(p => ({
      kind: p.kind || p.type || '?', mass: p.mass,
      owner: !!p.owner, edible: !!p.edible, keep: !!p.keep,
      x: p.body ? +p.body.position.x.toFixed(1) : null,
      z: p.body ? +p.body.position.z.toFixed(1) : null
    }))
    // ---- surface / mood
    o.moodKeys = g.mood ? Object.keys(g.mood) : null
    o.loaf = { loaf: g.capy.loaf, hasAsk: typeof g.loafAsk }
    o.zones = ['calcadao', 'avenue', 'sand', 'bateria'].map(n => {
      try { return n + '=' + r.inZone(n, sp.x, sp.z) } catch (e) { return n + '=ERR' }
    })
    o.solidBodies = g.world.bodies.length
    return o
  })
  out.errors = errs.slice(0, 12)
  await page.evaluate(async o => {
    await fetch('/shot?name=p3r-survey.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
