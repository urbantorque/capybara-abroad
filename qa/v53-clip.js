async page => {
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6000)
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(3000)
  await page.evaluate(async () => {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
    const g = window.__capy
    g.biome.switchTo('monaco')
    const sp = g.biome.spawnOf('monaco'), cb = g.capy.body
    cb.position.set(sp.x, sp.y, sp.z); cb.velocity.set(0, 0, 0)
    await sleep(2500)
    const txt = await fetch('/src/shared.js').then(r => r.text())
    const b = txt.slice(txt.indexOf('export const TASKS'), txt.indexOf('export const CHAPTERS'))
    const re = /\{\s*id:\s*'([^']+)'[\s\S]*?chapter:\s*(\d+)/g
    let m
    while ((m = re.exec(b))) if (Number(m[2]) === 18) g.hud.completeTask(m[1])
    await sleep(1500)
  })
  const sizes = [[1280, 760], [900, 600], [560, 800], [380, 740], [320, 640]]
  const out = []
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(1200)
    out.push(await page.evaluate(a => {
      const el = document.querySelector('.capyui-clue')
      if (!el) return { w: a.w, h: a.h, missing: true }
      const cs = getComputedStyle(el)
      const card = document.querySelector('.capyui-todo')
      return {
        w: a.w, h: a.h,
        recs: el.className.indexOf('recs') >= 0,
        lines: (el.textContent.match(/\n/g) || []).length + 1,
        scrollH: el.scrollHeight, clientH: el.clientHeight,
        clipped: el.scrollHeight > el.clientHeight + 1,
        maxH: cs.maxHeight, fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        cardW: card ? Math.round(card.getBoundingClientRect().width) : null,
        cardBottom: card ? Math.round(card.getBoundingClientRect().bottom) : null,
        vh: a.h,
      }
    }, { w, h }))
  }
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.evaluate(o => fetch('/shot?name=v53clip.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out)
}
