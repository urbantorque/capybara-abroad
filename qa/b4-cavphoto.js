async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5188/index.html')
  await page.waitForTimeout(6500)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)

  // deep in the dark, well past where any daylight reaches
  await page.evaluate(() => {
    const g = window.__capy
    g.biome.switchTo('cave')
    const A = g.cave, b = g.capy.body
    const x = 0, z = -86
    const ty = A.terrainHeight(x, z)
    b.position.set(x, ty + 0.6, z); b.velocity.set(0, 0, 0)
    b.previousPosition.copy(b.position); b.interpolatedPosition.copy(b.position)
    g.input.x = 0; g.input.z = 0
    for (let i = 0; i < 200; i++) g.tick(1 / 60, false)
  })
  await page.waitForTimeout(1200)
  // photo mode on, shutter
  await page.keyboard.press('k')
  await page.waitForTimeout(1400)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1400)

  const out = await page.evaluate(() => {
    const g = window.__capy
    const R = { daylight: g.cave && g.cave.daylight ? +g.cave.daylight().toFixed(3) : null,
                lift: g.post && g.post.params ? +g.post.params.liftR.toFixed(4) : null,
                vig: g.post && g.post.params ? +g.post.params.vignette.toFixed(3) : null,
                contrast: g.post && g.post.params ? +g.post.params.contrast.toFixed(3) : null }
    // read the album back and measure the thumbnail we just wrote
    let raw = null
    try { raw = localStorage.getItem('capy3.album.v1') } catch (e) {}
    R.albumBytes = raw ? raw.length : 0
    if (!raw) { R.issue = 'nothing in the album'; return Promise.resolve(R) }
    let arr = []
    // THE ALBUM IS { v, shots: [...] }, NOT A BARE ARRAY.
    try { const o = JSON.parse(raw); arr = (o && o.shots) || [] } catch (e) { R.issue = 'album is not json'; return Promise.resolve(R) }
    R.tiles = arr.length
    const last = arr[arr.length - 1]
    if (!last || !last.u) { R.issue = 'last tile has no image'; return Promise.resolve(R) }
    R.place = last.place; R.cap = last.cap
    return new Promise(res => {
      const im = new Image()
      im.onload = function () {
        const c = document.createElement('canvas')
        c.width = im.width; c.height = im.height
        const x = c.getContext('2d')
        x.drawImage(im, 0, 0)
        const d = x.getImageData(0, 0, c.width, c.height).data
        let sum = 0, mx = 0, black = 0, n = 0
        for (let i = 0; i < d.length; i += 4) {
          const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
          sum += l; if (l > mx) mx = l; if (l < 16) black++; n++
        }
        R.w = c.width; R.h = c.height
        R.meanLuma = +(sum / n).toFixed(1)
        R.maxLuma = Math.round(mx)
        R.pctBlack = +(100 * black / n).toFixed(1)
        res(R)
      }
      im.onerror = function () { R.issue = 'thumbnail would not decode'; res(R) }
      im.src = last.u
    })
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4-cavphoto.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
