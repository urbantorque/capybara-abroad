async page => {
  // T3d, the ridge's tone against Kyoto's sky: the west lens (the widest ridge in frame)
  // drawn through the composite with the layer's material swapped for variants, and the
  // mean colour of the ridge pixels (the hide-and-diff mask) against the sky band just over
  // them. A ridge that ends up lighter than its sky reads as snow, not as a hill in haze.
  const NAME = 'ten-t3d-far-tone'
  const out = {}
  out.rows = await page.evaluate(async () => {
    const g = window.__capy, THREE = g.THREE, K = g.kyoto
    let layer = null
    g.scene.traverse(o => { if (o.isMesh && o.name === 'far-kyoto') layer = o })   // the bundle's group carries the same name
    const m0 = layer.material
    const L = { cam: [-30, 4.0, 20], look: [-120, 4.0, 30] }
    const grab = () => {
      g.tick(1 / 60, false)
      g.camera.position.set(L.cam[0], K.terrainHeight(L.cam[0], L.cam[2]) + L.cam[1], L.cam[2])
      g.camera.lookAt(new THREE.Vector3(L.look[0], L.look[1], L.look[2]))
      g.camera.updateMatrixWorld(true)
      g.post.render()
      const c = g.renderer.domElement, t = document.createElement('canvas')
      t.width = c.width; t.height = c.height
      t.getContext('2d').drawImage(c, 0, 0)
      return { d: t.getContext('2d').getImageData(0, 0, t.width, t.height).data, w: t.width, h: t.height, url: c.toDataURL('image/png') }
    }
    g.state.noKyoFar = true
    const B = grab()
    g.state.noKyoFar = false
    const variants = {
      base: null,
      nofog: { fog: false },
      k0: { color: 0x587a68 },
      k0nofog: { color: 0x587a68, fog: false },
    }
    const rows = {}
    for (const v of Object.keys(variants)) {
      const o = variants[v]
      if (o) { const m = m0.clone(); if (o.color !== undefined) m.color.setHex(o.color); if (o.fog !== undefined) m.fog = o.fog; m.needsUpdate = true; layer.material = m } else layer.material = m0
      const A = grab()
      let n = 0, r = 0, gg = 0, b = 0
      const top = new Array(A.w).fill(-1)
      for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
        const i = (y * A.w + x) * 4
        const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
        if (dd > 6) { n++; r += A.d[i]; gg += A.d[i + 1]; b += A.d[i + 2]; if (top[x] < 0) top[x] = y }
      }
      // the sky: 6-14 px above the ridge's top edge, same columns
      let sn = 0, sr = 0, sg = 0, sb = 0
      for (let x = 0; x < A.w; x++) if (top[x] > 20) for (let y = top[x] - 14; y < top[x] - 6; y++) { const i = (y * A.w + x) * 4; sn++; sr += A.d[i]; sg += A.d[i + 1]; sb += A.d[i + 2] }
      const lum = (a, c, e) => +((0.2126 * a + 0.7152 * c + 0.0722 * e) / 255).toFixed(3)
      rows[v] = { n, ridge: n ? [r / n, gg / n, b / n].map(Math.round) : null, sky: sn ? [sr / sn, sg / sn, sb / sn].map(Math.round) : null,
        ridgeLum: n ? lum(r / n, gg / n, b / n) : 0, skyLum: sn ? lum(sr / sn, sg / sn, sb / sn) : 0 }
      await fetch('/shot?name=ten-t3d-far-tone-' + v, { method: 'POST', body: A.url.split(',')[1] })
    }
    layer.material = m0
    return rows
  })
  await page.evaluate(o => fetch('/shot?name=' + o.name + '.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o.out)))) }), { name: NAME, out })
}
