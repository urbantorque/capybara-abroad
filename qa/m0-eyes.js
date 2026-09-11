async page => {
  const out = { rows: [], errs: [] }
  page.on('console', m => { if (m.type() === 'error') out.errs.push(String(m.text()).slice(0, 220)) })
  page.on('pageerror', e => { out.errs.push('PAGEERROR ' + String(e.message).slice(0, 220)) })
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(6500)
  await page.evaluate(() => { document.querySelector('.capyui-go').click() })
  await page.waitForTimeout(2500)
  out.started = await page.evaluate(() => window.__capy.state.started)

  const list = ['sydney', 'pasto', 'quay', 'kyoto', 'cali', 'rio', 'iceland',
                'sahara', 'drift', 'venice', 'kowloon', 'palawan', 'goreme',
                'manly', 'pantanal', 'cave', 'antarctic', 'monaco', 'hanoi']
  for (let i = 0; i < list.length; i++) {
    const b = list[i]
    await page.evaluate((n) => { window.__capy.hud.cross(n) }, b)
    await page.waitForTimeout(8000)
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(2400)
    await page.keyboard.up('KeyW')
    await page.waitForTimeout(9000)
    const tag = String(i + 1).padStart(2, '0')
    await page.screenshot({ path: 'qa/m0-' + tag + '-' + b + '.png' })
    const row = await page.evaluate(() => {
      const g = window.__capy
      const st = g.state
      return { cur: g.biome.current,
               lastError: st.lastError ? String(st.lastError).slice(0, 160) : null,
               tris: g.renderer.info.render.triangles,
               calls: g.renderer.info.render.calls,
               pos: [+g.capy.position.x.toFixed(1), +g.capy.position.y.toFixed(1), +g.capy.position.z.toFixed(1)] }
    })
    out.rows.push(row)
  }
  await page.evaluate(async (o) => {
    await fetch('/shot?name=m0-eyes.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
