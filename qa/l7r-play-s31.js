async page => {
  const before = await page.evaluate(() => {
    const ks = Object.keys(localStorage)
    const g = window.__capy
    return { keys: ks.map(k => [k, (localStorage.getItem(k) || '').length]), biome: g.biome.current, done: g.state && g.state.done ? Object.keys(g.state.done).length : null }
  })
  await page.reload()
  await page.waitForTimeout(7000)
  await page.screenshot({ path: 'qa/l7r-play-67.png' })
  const after = await page.evaluate(() => ({ title: document.body.innerText.slice(0, 400), keys: Object.keys(localStorage).map(k => [k, (localStorage.getItem(k) || '').length]) }))
  await page.evaluate((o) => fetch('/shot?name=l7r-play-s31.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), { before, after })
}
