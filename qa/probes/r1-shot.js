async page => {
  await page.reload()
  await page.waitForTimeout(5500)
  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)

  const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD']
  let held = {}
  const setKeys = async (want) => {
    for (const k of KEYS) {
      if (want[k] && !held[k]) { await page.keyboard.down(k); held[k] = 1 }
      else if (!want[k] && held[k]) { await page.keyboard.up(k); held[k] = 0 }
    }
  }
  const walkTo = async (tx, tz, budgetMs, near) => {
    const t0 = Date.now()
    await page.keyboard.down('ShiftLeft')
    while (Date.now() - t0 < budgetMs) {
      const st = await page.evaluate(([x, z]) => {
        const g = window.__capy, p = g.capy.position, y = g.input.camYaw
        const wx = x - p.x, wz = z - p.z
        const d = Math.hypot(wx, wz)
        const nx = d > 0.001 ? wx / d : 0, nz = d > 0.001 ? wz / d : 0
        const c = Math.cos(y), s = Math.sin(y)
        return { d: d, ix: nx * c - nz * s, iz: nx * s + nz * c }
      }, [tx, tz])
      if (st.d < (near || 1.6)) break
      await setKeys({ KeyD: st.ix > 0.34, KeyA: st.ix < -0.34,
                      KeyS: st.iz > 0.34, KeyW: st.iz < -0.34 })
      await page.waitForTimeout(110)
    }
    await setKeys({})
    await page.keyboard.up('ShiftLeft')
  }

  await walkTo(-40, 6, 26000, 2.0)
  await walkTo(-40, -6, 16000, 2.0)
  await walkTo(-40, -14, 14000, 1.8)
  await walkTo(-40, -20.4, 14000, 1.0)
  await page.waitForTimeout(1200)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(1400)
}
