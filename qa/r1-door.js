async page => {
  await page.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  await page.reload()
  await page.waitForTimeout(5500)
  const out = { legs: [] }

  out.freshTitle = await page.evaluate(() => {
    const g = window.__capy
    return { started: !!g.state.started, save: localStorage.getItem('capy3.journey.v1') }
  })

  await page.mouse.click(20, 20)
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(3500)
  out.landed = await page.evaluate(() => {
    const g = window.__capy
    const p = g.capy.position
    return { biome: g.biome.current, started: !!g.state.started,
             x: +p.x.toFixed(1), z: +p.z.toFixed(1) }
  })

  const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD']
  let held = {}
  const setKeys = async (want) => {
    for (const k of KEYS) {
      if (want[k] && !held[k]) { await page.keyboard.down(k); held[k] = 1 }
      else if (!want[k] && held[k]) { await page.keyboard.up(k); held[k] = 0 }
    }
  }
  const release = async () => { await setKeys({}) }

  const walkTo = async (tx, tz, budgetMs, near) => {
    const t0 = Date.now()
    let best = 1e9
    await page.keyboard.down('ShiftLeft')
    while (Date.now() - t0 < budgetMs) {
      const st = await page.evaluate(([x, z]) => {
        const g = window.__capy, p = g.capy.position, y = g.input.camYaw
        const wx = x - p.x, wz = z - p.z
        const d = Math.hypot(wx, wz)
        const nx = d > 0.001 ? wx / d : 0, nz = d > 0.001 ? wz / d : 0
        const c = Math.cos(y), s = Math.sin(y)
        return { d: d, ix: nx * c - nz * s, iz: nx * s + nz * c,
                 x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) }
      }, [tx, tz])
      if (st.d < best) best = st.d
      if (st.d < (near || 1.6)) { await release(); break }
      await setKeys({ KeyD: st.ix > 0.34, KeyA: st.ix < -0.34,
                      KeyS: st.iz > 0.34, KeyW: st.iz < -0.34 })
      await page.waitForTimeout(110)
    }
    await release()
    await page.keyboard.up('ShiftLeft')
    const end = await page.evaluate(() => {
      const p = window.__capy.capy.position
      return { x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1) }
    })
    out.legs.push({ to: [tx, tz], end: end, closest: +best.toFixed(1) })
    return end
  }

  await walkTo(-40, 6, 22000, 2.0)
  await walkTo(-40, -6, 14000, 2.0)
  await walkTo(-40, -14, 12000, 1.8)
  await walkTo(-40, -20.6, 12000, 1.2)
  await page.waitForTimeout(900)

  out.atWharf = await page.evaluate(() => {
    const p = window.__capy.capy.position
    const el = document.querySelector('.capyui-home')
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1),
             promptShown: !!(el && el.classList.contains('show')),
             promptText: el ? el.textContent : null,
             boardOpen: !!document.querySelector('.capyui-jr.show') }
  })

  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(500)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(500)
  const dotsAfterTwo = await page.evaluate(() => {
    const el = document.querySelector('.capyui-home')
    return el ? el.querySelectorAll('.capyui-dots i.on').length : -1
  })
  out.dotsAfterTwo = dotsAfterTwo
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(900)

  out.board = await page.evaluate(() => {
    const card = document.querySelector('.capyui-jr')
    const rows = Array.from(document.querySelectorAll('.capyui-jrrow'))
    return {
      open: !!(card && card.classList.contains('show')),
      foot: (document.querySelector('.capyui-jrfoot') || {}).textContent || null,
      enabled: rows.map((r, i) => (r.disabled ? 0 : i + 1)).filter(Boolean),
      go: rows.map((r, i) => (r.classList.contains('go') ? i + 1 : 0)).filter(Boolean)
    }
  })

  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(900)
  out.readOnly = await page.evaluate(() => {
    const card = document.querySelector('.capyui-jr')
    const rows = Array.from(document.querySelectorAll('.capyui-jrrow'))
    return {
      open: !!(card && card.classList.contains('show')),
      foot: (document.querySelector('.capyui-jrfoot') || {}).textContent || null,
      enabled: rows.map((r, i) => (r.disabled ? 0 : i + 1)).filter(Boolean),
      ariaDisabled: rows.map(r => r.getAttribute('aria-disabled')).slice(0, 3)
    }
  })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)

  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(400)
  await page.keyboard.press('KeyQ')
  await page.waitForTimeout(900)
  await page.keyboard.press('Digit2')
  await page.waitForTimeout(4500)
  out.travelled = await page.evaluate(() => {
    const g = window.__capy
    return { biome: g.biome.current, done: !!g.taskDone('to-pasto') }
  })

  out.lastError = await page.evaluate(() => window.__capy.state.lastError || null)

  await page.evaluate(async (o) => {
    await fetch('/shot?name=r1-door.json', { method: 'POST',
      body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) })
  }, out)
}
