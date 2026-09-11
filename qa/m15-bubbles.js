async page => {
  // m15-bubbles.js — DO TWO BUBBLES EVER SIT ON TOP OF EACH OTHER?
  //
  // Measured off the RENDERED RECTANGLES, because that is the only thing the
  // player can read. Sample at 10 Hz for a minute in each of four crowded
  // chapters and count the frames in which any two visible bubbles overlap by
  // more than a few pixels, plus the worst overlap seen.
  //
  // Two people answering at once is by design — both localsSay and
  // npcOnIncident allow two — so this is not a rare collision and a run that
  // sees none of them at all is a run that was not busy enough to count.
  const out = { rows: [] }
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => {
    const all = Array.prototype.slice.call(document.querySelectorAll('.capyui-go'))
    const b = all.filter(function (e) { return !e.classList.contains('alt') })[0] || all[0]
    if (b) b.click()
  })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)
  for (const b of ['sahara', 'venice', 'kowloon', 'sydney']) {
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    // Be a menace: a wheek reaches everybody in earshot and two of them answer,
    // which is the case this is about. Walk between them so the pool refills.
    await page.evaluate(() => {
      const g = window.__capy
      window.__ov = { frames: 0, hits: 0, worst: 0, pairs: 0, maxUp: 0 }
      window.__ovT = setInterval(function () {
        const els = document.querySelectorAll('div[style]')
        const boxes = []
        for (let i = 0; i < els.length; i++) {
          if (els[i].className) continue
          const t = (els[i].textContent || '').trim()
          if (!t || t.length > 140) continue
          // NOT a string match on the style attribute: npc.js writes
          // 'position:absolute' with no space and the CSSOM re-serialises it
          // WITH one, so the obvious test finds nothing at all -- and a probe
          // that finds nothing reads exactly like a feature that works. The
          // first run of this reported maxUp 0 in four chapters.
          if (els[i].style.position !== 'absolute') continue
          if (els[i].style.display === 'none') continue
          const r = els[i].getBoundingClientRect()
          if (r.width < 30 || r.height < 10) continue
          boxes.push(r)
        }
        window.__ov.frames++
        if (boxes.length > window.__ov.maxUp) window.__ov.maxUp = boxes.length
        let bad = 0
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const ox = Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left)
            const oy = Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top)
            if (ox > 4 && oy > 4) {
              bad++
              const a = Math.min(ox * oy / Math.max(1, boxes[i].width * boxes[i].height), 1)
              if (a > window.__ov.worst) window.__ov.worst = +a.toFixed(3)
            }
          }
        }
        if (bad) { window.__ov.hits++; window.__ov.pairs += bad }
      }, 100)
    })
    for (let k = 0; k < 6; k++) {
      await page.keyboard.press('KeyQ')
      await page.keyboard.down('KeyW')
      await page.waitForTimeout(1800)
      await page.keyboard.up('KeyW')
      await page.waitForTimeout(3200)
    }
    out.rows.push(await page.evaluate(() => {
      clearInterval(window.__ovT)
      const g = window.__capy
      return { cur: g.biome.current, ov: window.__ov }
    }))
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m15-bubbles.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
