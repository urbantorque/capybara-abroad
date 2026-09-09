async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch(e){} })
  await page.goto('http://localhost:5188/')
  await page.waitForTimeout(6000)
  await page.mouse.click(640, 400)
  await page.waitForTimeout(2500)
  const out = await page.evaluate(async () => {
    function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
    const g = window.__capy
    g.biome.switchTo('manly'); await sleep(1200)
    const m = g.manly, capy = g.capy, b = capy.body
    const o = { toasts: [], cheers: [], payoutCams: [], bubbles: [], praise: [] }
    // count the CEREMONY, not the task: a one-shot must not repeat.
    const rt = g.toast
    g.toast = function (t) { o.toasts.push({ t: t, z: +capy.position.z.toFixed(1) }); return rt.apply(g, arguments) }
    const rs = g.sfx
    g.sfx = function (n, op) { if (n === 'cheer') o.cheers.push({ n: n, force: !!(op&&op.force), vol: op&&op.volume, at: !!(op&&(op.at||typeof op.x==='number')) }); return rs.apply(g, arguments) }
    const rsay = g.say
    if (typeof rsay === 'function') g.say = function (x,y,z,t) { o.bubbles.push({ t: String(t).slice(0,50), d: +Math.hypot(x-capy.position.x, z-capy.position.z).toFixed(1) }); return rsay.apply(g, arguments) }
    // where are the locals relative to where a ride lands?
    o.locals = (g.locals||[]).filter(l => l.biome === 'manly').map(l => ({ x: +l.x.toFixed(0), z: +l.z.toFixed(0) }))
    const bankZ = m.bank().z
    for (let run = 0; run < 8; run++) {
      const before = o.toasts.length
      b.position.set(0, 0.6, bankZ - 6); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 2400; i++) {
        g.tick(1/60, false)
        if (o.toasts.length > before) {
          const cam = g.camera, p = capy.position
          const dx = cam.position.x-p.x, dy = cam.position.y-p.y, dz = cam.position.z-p.z
          const flat = Math.hypot(dx, dz)
          o.payoutCams.push({ run: run, capyZ: +p.z.toFixed(1),
            flat: +flat.toFixed(2), raise: +dy.toFixed(2), dist: +Math.hypot(dx,dy,dz).toFixed(2),
            yawDeg: +(Math.atan2(dx,dz)*180/Math.PI).toFixed(1),
            pitchDeg: +(Math.atan2(dy,flat)*180/Math.PI).toFixed(1),
            rigW: m.rig() ? +m.rig().w.toFixed(2) : 0,
            speed: +Math.hypot(capy.velocity.x, capy.velocity.z).toFixed(2) })
          break
        }
        if (capy.position.z > 26) break
      }
      await sleep(0)
    }
    // did the praise layer speak? snapshot HUD text
    o.hud = (document.querySelector('#hud') || {}).innerText || ''
    o.hud = o.hud.replace(/\s+/g,' ').slice(0,300)
    return o
  })
  await page.evaluate(async o => { await fetch('/shot?name=b4man-4.json', {method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o))))}) }, out)
}
