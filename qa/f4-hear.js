async page => {
  const wait = ms => page.evaluate(m => new Promise(r => setTimeout(r, m)), ms);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await wait(4500);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await wait(6500);
  await page.keyboard.press('Digit1');
  await wait(5000);
  const out = {};
  // A line said by somebody the camera is NOT looking at has to reach the
  // toast; a line said by somebody on screen must NOT (it has a bubble).
  out.run = await page.evaluate(async () => {
    const g = window.__capy;
    const toasts = () => Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent);
    const near = (g.locals || []).filter(L => L && L.biome === g.biome.current && L.group);
    const roster = g.npcs.filter(r => r && r.group);
    const who = near[0] || roster[0];
    if (!who) return { nobody: true };
    // Stand right next to them so the distance gate passes...
    const b = g.capy.body;
    b.position.set(who.group.position.x + 2, b.position.y, who.group.position.z + 2);
    b.velocity.set(0, 0, 0);
    await new Promise(r => setTimeout(r, 1200));
    const before = toasts().length;
    // ...and put them behind the camera by teleporting them there.
    const cam = g.camera.position;
    const capy = g.capy.position;
    const bx = capy.x + (capy.x - cam.x) * 0.25, bz = capy.z + (capy.z - cam.z) * 0.25;
    void bx; void bz;
    // Simpler and more honest: say the line, then check whether a bubble was
    // shown. If it was, the speaker was on screen and the toast must not fire.
    const dist = Math.hypot(who.group.position.x - capy.x, who.group.position.z - capy.z);
    g.say(who.group.position.x, who.group.position.y, who.group.position.z, 'ZZTEST off-screen line');
    await new Promise(r => setTimeout(r, 900));
    const shown = Array.from(document.querySelectorAll('.capyui-bub'))
      .filter(e => e.style.display !== 'none' && /ZZTEST/.test(e.textContent)).length;
    const t = toasts();
    return { dist: +dist.toFixed(1), before, bubbleShown: shown,
             toastHasIt: t.some(x => /ZZTEST/.test(x)), toasts: t.slice(-3) };
  });
  // ...and now the same line from somebody far behind the camera.
  out.behind = await page.evaluate(async () => {
    const g = window.__capy;
    const cam = g.camera.position, capy = g.capy.position;
    // 8 m the OTHER side of the animal from the camera: inside npcSAY_HEAR and
    // outside the frustum, which is exactly the case this feature is for.
    const ux = capy.x - cam.x, uz = capy.z - cam.z;
    const m = Math.hypot(ux, uz) || 1;
    const x = capy.x + (ux / m) * 8, z = capy.z + (uz / m) * 8;
    g.say(x, capy.y, z, 'ZZBEHIND said at your back');
    await new Promise(r => setTimeout(r, 900));
    const shown = Array.from(document.querySelectorAll('.capyui-bub'))
      .filter(e => e.style.display !== 'none' && /ZZBEHIND/.test(e.textContent)).length;
    const t = Array.from(document.querySelectorAll('.capyui-toast')).map(e => e.textContent);
    return { bubbleShown: shown, toastHasIt: t.some(x2 => /ZZBEHIND/.test(x2)), toasts: t.slice(-3) };
  });
  out.err = await page.evaluate(() => window.__capy.state.lastError ? String(window.__capy.state.lastError) : null);
  const bl = await page.evaluate(o => btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))), out);
  await page.evaluate(s => fetch('/shot?name=f4-hear.json', { method: 'POST', body: s }), bl);
}
