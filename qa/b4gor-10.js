async page => {
  const o = await page.evaluate(() => {
    const g = window.__capy, A = g.goreme
    const t = A.truck()
    const b = g.capy.body
    const gy = A.terrainHeight(t.x, t.z)
    // stand exactly in the cab: cab box is 2.2 x 1.1 x 2.6 centred 0.95 up, at z-0.6
    b.position.set(t.x, gy + 0.9, t.z - 0.6)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 180; i++) g.tick(1/60, false)
    const insideCab = Math.abs(b.position.x - t.x) < 1.1 && Math.abs(b.position.z - (t.z-0.6)) < 1.3
    // and on the trailer deck: deck top at 0.92, at z+2.4
    b.position.set(t.x, gy + 2.2, t.z + 2.4)
    b.velocity.set(0,0,0); b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    for (let i = 0; i < 180; i++) g.tick(1/60, false)
    const deckY = b.position.y - gy
    return { truck: [+t.x.toFixed(1), +t.z.toFixed(1)], gy: +gy.toFixed(2),
             stillInCab: insideCab, cabY: null,
             restYAfterDropOnDeck: +deckY.toFixed(2), deckTopShouldBe: 0.92 }
  })
  await page.evaluate(async q => { await fetch('/shot?name=b4gor-10.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(q))))}) }, o)
}
