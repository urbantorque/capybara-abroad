async page => {
  await page.reload()
  await page.waitForTimeout(5000)
  const built = await page.evaluate(async () => {
    const src = await (await fetch('/src/shared.js')).text()
    const b = src.slice(src.indexOf('export const TASKS = ['),
                        src.indexOf('\n];', src.indexOf('export const TASKS = [')))
    const re = /\{\s*id:\s*'([^']+)'[\s\S]*?chapter:\s*(\d+)/g
    const byCh = {}
    let m
    while ((m = re.exec(b))) {
      const c = Number(m[2])
      ;(byCh[c] = byCh[c] || []).push(m[1])
    }
    const tasks = []
    const full = [1, 7, 10, 16]
    for (const c of full) tasks.push(...byCh[c])
    for (const [c, n] of [[4, 5], [12, 7], [17, 3], [3, 4]]) tasks.push(...byCh[c].slice(0, n))
    const save = {
      v: 1, told: 1, tasks: tasks, seen: [1, 3, 4, 7, 10, 12, 16, 17],
      recs: { 'glacier-run': 19.4, 'hot-spring': 9.2, 'passerelle': 21.7, 'pigeon-storm': 168,
              'seagull-chips': 11, 'great-wall': 44.6, 'first-dive': 12.8, 'manly-voyage': 71.3 },
      chapms: { 1: 1512000, 7: 1284000, 10: 1601000, 16: 1122000 },
      ms: 9330000, biome: 'venice',
    }
    localStorage.setItem('capy3.journey.v1', JSON.stringify(save))
    return { tasks: tasks.length, chapters: Object.keys(byCh).length }
  })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(6000)
  const out = await page.evaluate((n) => {
    const g = window.__capy
    return { built: n, started: g.state.started, biome: g.biome.current,
             err: g.state.lastError || null,
             head: document.querySelector('.capyui-todo h2').textContent }
  }, built)
  await page.evaluate(async (o) => {
    await fetch('/shot?name=v18a.json', {
      method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))),
    })
  }, out)
}
