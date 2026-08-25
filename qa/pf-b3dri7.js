async page => {
  const out = await page.evaluate(async () => {
    const g = window.__capy, R = {}
    const live = g.biome.current, d = g.drift
    const props = g.props.filter(p => !p.removed && (!p.biome || p.biome === live))
    const mug = props.filter(p => p.type === 'mug')[0]
    const trav = g.locals.filter(r => r.biome === live && Math.abs(r.ax - 26.4) < 1)[0]
    R.live = live; R.have = !!mug && !!trav
    if (!mug || !trav) return R
    mug.homeX = 18; mug.homeZ = 34
    mug.body.wakeUp()
    mug.body.position.set(15, d.terrainHeight(15, 34) + 0.4, 34)
    mug.body.previousPosition.copy(mug.body.position)
    mug.body.interpolatedPosition.copy(mug.body.position)
    g.events.emit('capy:grab', { prop: mug })
    R.ownedNow = !!trav.own
    const x0 = trav.x, z0 = trav.z
    let walked = 0
    for (let s = 0; s < 40; s++) {
      for (let i = 0; i < 30; i++) g.tick(1 / 60, false)
      walked = Math.max(walked, Math.hypot(trav.x - x0, trav.z - z0))
    }
    R.walked = +walked.toFixed(2)
    R.ended = !trav.own
    R.mugBack = +Math.hypot(mug.body.position.x - 18, mug.body.position.z - 34).toFixed(2)
    return R
  })
  await page.evaluate(async o => {
    await fetch('/shot?name=b3dri7.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) })
  }, out)
}
