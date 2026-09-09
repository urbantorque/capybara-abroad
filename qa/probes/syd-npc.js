async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2500)
  const t = []
  for (let i = 0; i < 24; i++) {
    t.push(await page.evaluate(() => {
      const g = window.__capy
      const pick = k => g.npcs.filter(r => r && r.kind === k).map(r => ({
        id: r.id, st: r.state, t: +(r.stateT || 0).toFixed(1),
        p: [+r.group.position.x.toFixed(1), +r.group.position.z.toFixed(1)],
        si: r.serveI }))
      return { waiter: pick('waiter'), queue: pick('queue').slice(0, 2) }
    }))
    await page.waitForTimeout(1000)
  }
  const geo = await page.evaluate(() => {
    const g = window.__capy
    const e = g.env
    return { zones: e.zones ? Object.keys(e.zones) : null,
             terrace: e.zones && e.zones.terrace ? e.zones.terrace : null,
             counter: e.counter || null, tables: e.tables || null,
             all: Object.keys(e).filter(k => /table|counter|terr/i.test(k)) }
  })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=sydnpc.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, { t, geo })
}
