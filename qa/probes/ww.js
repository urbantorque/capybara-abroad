async page => {
  const a = await page.evaluate(() => ({ t: window.__capy.state.time, w: performance.now() }))
  await page.evaluate(() => new Promise(r => setTimeout(r, 15000)))
  const b = await page.evaluate(() => ({ t: window.__capy.state.time, w: performance.now() }))
  const out = { gameDt: +(b.t - a.t).toFixed(2), wallDt: +((b.w - a.w)/1000).toFixed(2) }
  await page.evaluate(async (o) => { await fetch('/shot?name=ww.json', { method:'POST', body: btoa(JSON.stringify(o)) }) }, out)
}
