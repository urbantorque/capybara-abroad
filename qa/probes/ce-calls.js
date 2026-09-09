async page => {
  await page.reload(); await page.waitForTimeout(5500)
  await page.mouse.click(400, 400); await page.waitForTimeout(2500)
  const names = ['sydney','pasto','quay','kyoto','cali','rio','iceland','sahara','drift',
                 'venice','kowloon','palawan','goreme','manly','pantanal','cave','antarctic']
  const out = {}
  for (const n of names) {
    out[n] = await page.evaluate(async (name) => {
      function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
      const g = window.__capy
      g.biome.switchTo(name)
      const sp = g.biome.spawnOf(name), b = g.capy.body
      b.position.set(sp.x, sp.y, sp.z); b.velocity.set(0,0,0)
      await sleep(1500)
      // MAIN PASS ONLY, the way CONTRACT.md's historic figures were taken:
      // shadows off (their pass is counted too once autoReset is false), and
      // one direct render of the scene rather than the post chain.
      const r = g.renderer
      const wasShadow = r.shadowMap.enabled
      const wasAuto = r.info.autoReset
      r.shadowMap.enabled = false
      r.info.autoReset = false
      r.info.reset()
      r.setRenderTarget(null)
      r.render(g.scene, g.camera)
      const main = { calls: r.info.render.calls, tris: r.info.render.triangles }
      r.info.reset()
      r.shadowMap.enabled = wasShadow
      r.render(g.scene, g.camera)
      const withShadow = { calls: r.info.render.calls, tris: r.info.render.triangles }
      r.info.autoReset = wasAuto
      r.info.reset()
      return { mainCalls: main.calls, mainTris: main.tris,
               shadowCalls: withShadow.calls - main.calls, err: g.state.lastError || null }
    }, n)
  }
  await page.evaluate(async (o) => { await fetch('/shot?name=calls.json', { method:'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }) }, out)
}
