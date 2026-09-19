async page => {
  // Two close-ups for the animal's small parts (nails, whisker nubs, eye
  // fleck): own camera, raw render, ~1 m. Assumes wow-round.js already ran in
  // this session (window.__art is defined and the game is in Sydney).
  const out = { shots: [] }
  const post = async (name, url) => {
    await page.evaluate(async (o) => { await fetch('/shot?name=' + o.n, { method: 'POST', body: o.u }) }, { n: name, u: url })
    out.shots.push(name)
  }
  await page.evaluate(() => { window.__capy.state.noRound = false; window.__capy.state.paused = true })
  await page.waitForTimeout(200)
  out.muzzle = await page.evaluate(() => window.__art.capyShot(Math.PI / 2 + 0.35, 1.1, 0.12, 0.30, 0.62, 30))
  await post('WR2-close-muzzle', out.muzzle); delete out.muzzle
  out.foot = await page.evaluate(() => window.__art.capyShot(0.45, 1.3, 0.25, 0.02, 0.45, 30))
  await post('WR2-close-foot', out.foot); delete out.foot
  out.eye = await page.evaluate(() => window.__art.capyShot(0.9, 0.9, 0.25, 0.40, 0.50, 26))
  await post('WR2-close-eye', out.eye); delete out.eye
  await page.evaluate(() => { window.__capy.state.paused = false })
  return out
}
