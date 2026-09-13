async page => {
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /carry on/i.test(b.textContent)); if (b) b.click(); else document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(6000)
  await page.evaluate(() => window.__capy.hud.cross('sydney'))
  await page.waitForTimeout(9000)
  const leaves = () => page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && r.width > 0 && e.children.length === 0 && e.textContent.trim() }).map(e => e.textContent.trim()))
  const trial = async (x, z, label) => {
    await page.evaluate((p) => { const b = window.__capy.capy.body; b.position.set(p.x, 2.2, p.z); b.velocity.set(0, 0, 0) }, { x, z })
    await page.waitForTimeout(1500)
    const base = new Set(await leaves())
    const pos = await page.evaluate(() => { const p = window.__capy.capy.body.position; return [p.x, p.y, p.z].map(v => +v.toFixed(2)) })
    await page.keyboard.press('KeyQ')
    const seen = {}
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(250)
      const now = await leaves()
      for (const t of now) if (!base.has(t) && !seen[t]) seen[t] = (i + 1) * 250
    }
    const audit = await page.evaluate(() => { const e = window.__capy.env; return e && e.concertAudit ? e.concertAudit() : null })
    return { label, pos, seen, audit }
  }
  const out = []
  out.push(await trial(-0.5, 3.25, 'my spot (z 3.25, nose on red)'))
  await page.waitForTimeout(3000)
  out.push(await trial(-0.5, 1.5, 'centre of red (z 1.5)'))
  await page.waitForTimeout(3000)
  out.push(await trial(-0.5, 1.5, 'centre again (second note)'))
  await page.screenshot({ path: 'qa/l7r-play-68.png' })
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s32.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
