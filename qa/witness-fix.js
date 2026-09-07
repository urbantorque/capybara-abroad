async page => {
  // ---------------------------------------------------------------------------
  // qa/witness-fix.js — THE WITNESS GATE, BOTH WAYS (ROADMAP-FUN, B5)
  //
  // Making `findPeople` chapter-aware makes it STRICTER, and a stricter gate
  // can break the thing it protects. Both directions, in one run:
  //
  //   Sydney       the chain must still arm — there are really people there
  //   the Drift    it must not, and the chain's own comment says so
  //   Sơn Đoòng    nor here: nobody is in it at all
  //
  // `peopleNear` is read directly as well as through the pips, so a zero can
  // be told from a chain that simply did not fire.
  // ---------------------------------------------------------------------------
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit1')
  await page.waitForTimeout(9000)

  const rows = []
  for (const b of ['sydney', 'drift', 'cave', 'venice']) {
    if (b !== 'sydney') {
      await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
      await page.waitForTimeout(10000)
    }
    const r = await page.evaluate((arg) => {
      const g = window.__capy
      const p = g.capy.position
      const near = g.peopleNear ? g.peopleNear(p.x, p.z, 16) : -1
      const far = g.peopleNear ? g.peopleNear(p.x, p.z, 55) : -1
      // raw, unfiltered, for the contrast
      let ghosts = 0
      for (const q of (g.npcs || [])) {
        const gp = q && q.group && q.group.position
        if (gp && Math.hypot(gp.x - p.x, gp.z - p.z) < 55) ghosts++
      }
      for (let i = 0; i < 3; i++) {
        g.events.emit('prop:destroy', {
          prop: { disturbed: true, id: 'wf-' + arg.b + '-' + i,
                  body: { position: { x: p.x, y: p.y, z: p.z } } }
        })
      }
      return { biome: g.biome.current, want: arg.b, near16: near, near55: far,
               rawNpcsWithin55: ghosts }
    }, { b: b })
    await page.waitForTimeout(900)
    const pips = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('.capyui-pips b')]
      const el = document.querySelector('.capyui-pips')
      return { on: !!(el && el.classList.contains('on')),
               lit: bars.filter(x => x.classList.contains('lit')).length }
    })
    rows.push(Object.assign(r, { pips: pips }))
  }
  await page.evaluate((o) => {
    const s = btoa(unescape(encodeURIComponent(JSON.stringify(o))))
    return fetch('/shot?name=witness-fix.json', { method: 'POST', body: s })
  }, { rows: rows, errs: errs })
}
