async page => {
  const dump = async (name, extra) => {
    const out = await page.evaluate(() => {
      const g = window.__capy
      const vis = [...document.querySelectorAll('body *')].filter(e => {
        const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
        return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim()
      }).map(e => e.textContent.trim())
      const p = g.capy && g.capy.body ? g.capy.body.position : null
      return { t: Date.now(), biome: g.biome.current, pos: p && [p.x, p.y, p.z].map(v => +v.toFixed(1)), vis: vis.slice(-40), err: g.state.lastError }
    })
    out.extra = extra
    await page.evaluate((o) => fetch('/shot?name=' + o.name, { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name, out })
  }
  const aim = () => page.evaluate(() => {
    const li = [...document.querySelectorAll('li.capyui-task')].find(l => /tourist/.test(l.textContent))
    const ar = li && li.querySelector('.capyui-arrow')
    const m = ar && /rotate\((-?[\d.]+)deg\)/.exec(ar.style.transform)
    const d = document.querySelector('.capyui-mapdist span')
    return { ang: m ? +m[1] : null, op: ar ? ar.style.opacity : null, dist: d ? d.textContent : null, txt: li ? li.textContent.trim().slice(0, 80) : null }
  })
  const log = []
  for (let i = 0; i < 14; i++) {
    const a = await aim()
    let a2 = a.ang == null ? 0 : ((a.ang % 360) + 360) % 360
    let key = 'KeyW'
    if (a2 > 45 && a2 <= 135) key = 'KeyD'
    else if (a2 > 135 && a2 <= 225) key = 'KeyS'
    else if (a2 > 225 && a2 <= 315) key = 'KeyA'
    log.push({ i, ...a, key })
    await page.keyboard.down(key)
    await page.waitForTimeout(450)
    await page.keyboard.up(key)
    await page.keyboard.press('KeyE')
    await page.waitForTimeout(350)
    if (i === 6) await page.screenshot({ path: 'qa/l6r-play-37.png' })
  }
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'qa/l6r-play-38.png' })
  await dump('l6r-play-s17.json', log)
}
