async page => {
  await page.reload(); await page.waitForTimeout(4000)
  const a = await page.evaluate(() => { const g = window.__capy; return { live: g.music.live, playing: g.music.playing, started: g.state.started } })
  await page.mouse.click(1100, 600)   // the backdrop, not a button
  await page.waitForTimeout(1500)
  const b = await page.evaluate(() => { const g = window.__capy; return { live: g.music.live, playing: g.music.playing, started: g.state.started } })
  await page.evaluate(async (o) => {
    await fetch('/shot?name=s1title.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, { beforeGesture: a, afterBackdropClick: b })
}
