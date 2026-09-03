async page => {
  // D5, THE OTHER HALF: THE EMITTERS, AND WHAT THE BRIGHT PASS FINDS.
  //
  // Two numbers per chapter, both off the FINISHED frame, because the finished
  // frame is the only thing a player sees and every earlier attempt to reason
  // about the bright pass from its input was wrong about the shoulder.
  //
  //   blown   the fraction of the frame above 0.90 luma. This is the failure
  //           mode D45-13 and D45-11 are photographs of: a threshold set low
  //           enough to find the lamps finds the road as well, and the wide
  //           octave then carries it over everything.
  //   lit     the fraction above 0.75. A chapter is allowed plenty of this —
  //           it is the lamps and what they are lighting — and the pass is
  //           only a win if `blown` comes down while `lit` does not collapse.
  //
  // RUN IT TWICE, and the second run is the point: `git stash push -- src`,
  // rebuild, run, `git stash pop`. A single green run cannot tell "the pass
  // worked" from "this was never broken".
  const errs = []
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message || e)))
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) })
  await page.setViewportSize({ width: 1100, height: 660 })
  const out = { errs: [] }

  await page.goto('http://localhost:5188/')
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5200)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(7000)

  out.rows = await page.evaluate(async () => {
    const g = window.__capy
    async function shoot(name) {
      const d = g.renderer.domElement.toDataURL('image/png')
      await fetch('/shot?name=' + name, { method: 'POST', body: d.split(',')[1] })
    }
    const rows = []
    // The eight chapters with emitters in them, plus Sydney at noon as the
    // control: nothing in chapter one is switched on, so nothing about it may
    // move at all.
    for (const n of ['sydney', 'goreme', 'kowloon', 'cave', 'monaco',
                     'iceland', 'drift', 'antarctic', 'hanoi']) {
      g.biome.switchTo(n)
      // Ten seconds. The grade, the airlight and the hemisphere all damp in
      // over about eight after a switch — see the note in qa/d5-shore.js.
      for (let i = 0; i < 600; i++) g.tick(1 / 60, false)
      g.tick(1 / 60, true)
      const c = g.renderer.domElement
      const t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      const px = t.getContext('2d').getImageData(0, 0, t.width, t.height).data
      let blown = 0, lit = 0, sum = 0
      for (let i = 0; i < px.length; i += 4) {
        const l = (px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722) / 255
        sum += l
        if (l > 0.90) blown++
        if (l > 0.75) lit++
      }
      const n4 = px.length / 4
      rows.push({ biome: g.biome.current,
                  blown: +(100 * blown / n4).toFixed(2),
                  lit: +(100 * lit / n4).toFixed(2),
                  mean: +(sum / n4).toFixed(4),
                  thr: +g.post.params.threshold.toFixed(3),
                  wide: +g.post.params.wide.toFixed(3),
                  bloom: +g.post.params.bloom.toFixed(3) })
      if (n === 'goreme' || n === 'kowloon' || n === 'cave') await shoot('d5-glow-' + n)
    }
    return rows
  })

  out.errs = errs
  await page.evaluate((o) => fetch('/shot?name=d5-glow.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), out)
}
