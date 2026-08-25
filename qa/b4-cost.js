async page => {
  await page.reload()
  await page.waitForTimeout(6000)
  await page.mouse.click(400, 400)
  await page.waitForTimeout(2200)
  const ALL = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
               'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of ALL) {
    out[n] = await page.evaluate(async (name) => {
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0, 0, 0)
      for (let i = 0; i < 90; i++) g.tick(1 / 60, false)
      const R = { renderer: g.renderer }
      // ---- THE COST OF ONE FRAME, WITH VSYNC OUT OF THE WAY ---------------
      // rAF is pinned to the display, so every chapter measures 16.67 ms and
      // the number says nothing. Rendering N times back to back and dividing
      // is the only way to see what a chapter actually costs. gl.finish() at
      // the end so the GPU has really done the work before the clock stops.
      const gl = g.renderer.getContext()
      const render = () => {
        if (g.post && g.post.enabled) g.post.render()
        else g.renderer.render(g.scene, g.camera)
      }
      render(); gl.finish()                      // warm
      const N = 40
      const t0 = performance.now()
      for (let i = 0; i < N; i++) render()
      gl.finish()
      const full = (performance.now() - t0) / N

      // ...and the same with the shadow map switched off, which isolates the
      // pass this batch's sysEnableShadows change is about.
      const wasShadow = g.renderer.shadowMap.enabled
      g.renderer.shadowMap.enabled = false
      render(); gl.finish()
      const t1 = performance.now()
      for (let i = 0; i < N; i++) render()
      gl.finish()
      const noShadow = (performance.now() - t1) / N
      g.renderer.shadowMap.enabled = wasShadow

      // and the scene triangle count, honestly (renderer.info after a post
      // chain reports the composite quad — see the brief)
      let tris = 0
      g.scene.traverse(o => {
        if (!o.isMesh && !o.isInstancedMesh) return
        for (let p = o; p; p = p.parent) if (!p.visible) return
        const gm = o.geometry; if (!gm) return
        const t = gm.index ? gm.index.count / 3 : gm.attributes.position.count / 3
        tris += t * (o.isInstancedMesh ? o.count : 1)
      })
      return { fullMs: +full.toFixed(2), noShadowMs: +noShadow.toFixed(2),
               shadowMs: +(full - noShadow).toFixed(2), tris: Math.round(tris) }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=b4-cost.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
