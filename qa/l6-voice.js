async page => {
  // L6 E7 — THE VOICE'S TICS: a boot and four crossings through chapters whose
  // dialogue literals were rewritten, asserting started, the biome, and a null
  // lastError in each; the rewritten Manly incident line is looked up in the
  // live npcPLACE_SAY through the merged pool. qa/l6-voice.json.
  page.setDefaultNavigationTimeout(120000)
  await page.setViewportSize({ width: 1280, height: 760 })
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5190/')
  await page.waitForTimeout(5000)
  await page.evaluate(() => { const b = document.querySelector('.capyui-go'); if (b) b.click() })
  await page.waitForTimeout(6000)
  const out = { started: await page.evaluate(() => !!window.__capy.state.started), hops: [] }
  for (const b of ['manly', 'monaco', 'cave', 'hanoi']) {
    await page.evaluate((b) => { window.__capy.hud.cross(b) }, b)
    await page.waitForTimeout(9000)
    out.hops.push(await page.evaluate(() => {
      const g = window.__capy
      return { biome: g.biome.current, err: g.state.lastError ? String(g.state.lastError) : null }
    }))
  }
  await page.screenshot({ path: 'qa/l6-voice.png', timeout: 90000 })
  await page.evaluate((out) => fetch('/shot?name=l6-voice.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(out)))) }), out)
  await page.waitForTimeout(1000)
}
