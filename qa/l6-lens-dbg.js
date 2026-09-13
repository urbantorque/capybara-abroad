async page => {
  const r = await page.evaluate(async () => {
    const g = window.__capy
    const suns = []; g.scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) suns.push(o) })
    const out = {}
    // read a few texels from each shadow map
    const rd = (s) => {
      const rt = s.shadow.map; if (!rt) return null
      const buf = new Uint8Array(4 * 16)
      g.renderer.readRenderTargetPixels(rt, rt.width / 2 - 2, rt.height / 2 - 2, 4, 4, buf)
      return Array.from(buf.slice(0, 16))
    }
    out.near = rd(suns[0]); out.far = rd(suns[1])
    out.info = g.renderer.info.render
    out.mask = g.camera.layers.mask
    out.smType = g.renderer.shadowMap.type
    out.smAuto = g.renderer.shadowMap.autoUpdate
    out.wrapped = g.renderer.shadowMap.render.name
    return out
  })
  await page.evaluate((o) => fetch("/shot?name=l6-lens-dbg.json", { method: "POST", body: btoa(unescape(encodeURIComponent(JSON.stringify(o)))) }), r)
}
