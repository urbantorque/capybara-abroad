async page => {
  // ROADMAP-WOW2, T — is the paper's arrow the projection it claims to be?
  // Pins the arrow on steal-hat (F), then samples the DOM rotate() against
  // the same two-point projection through game.camera while D and W are held.
  // The two agreed to the degree; the 180° the bot saw came from a target
  // BEHIND the lens (w < 0 mirrors it) — see the arrow block in systems.js.
  // Writes qa/wow2-tut-arrow.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { window.__capy.state.noTut = true; const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  await page.keyboard.press('KeyF'); await page.waitForTimeout(600)
  const rows = []
  async function look(tag) {
    const r = await page.evaluate((tag) => {
      const g = window.__capy, c = g.capy, T = g.THREE
      const els = []
      for (const a of document.querySelectorAll('.capyui-aim.on')) {
        const ar = a.querySelector('.capyui-arrow')
        const d = a.querySelector('span')
        els.push({ par: a.parentNode.tagName + '.' + a.parentNode.className.slice(0, 30), tr: ar ? ar.style.transform : '', op: ar ? ar.style.opacity : '', dist: d ? d.textContent : '' })
      }
      const tg = g.hintTarget('steal-hat')
      let want = null
      if (tg) {
        const A = new T.Vector3(c.position.x, c.position.y, c.position.z).project(g.camera)
        const B = new T.Vector3(tg.x, c.position.y, tg.z).project(g.camera)
        want = Math.round(Math.atan2(B.x - A.x, B.y - A.y) * 180 / Math.PI)
      }
      return { tag, x: +c.position.x.toFixed(1), z: +c.position.z.toFixed(1), camYaw: +g.input.camYaw.toFixed(2), want, els }
    }, tag)
    rows.push(r)
  }
  await look('start')
  await page.keyboard.down('KeyD')
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(250); await look('D' + i) }
  await page.keyboard.up('KeyD')
  await page.waitForTimeout(500); await look('afterD')
  await page.keyboard.down('KeyW')
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(250); await look('W' + i) }
  await page.keyboard.up('KeyW')
  await page.evaluate((o) => fetch('/shot?name=wow2-tut-arrow.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), rows)
}
