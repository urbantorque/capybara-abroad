async page => {
  const out = {};
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.reload();
  await page.waitForTimeout(5000);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(1800);
  out.before = await page.evaluate(() => window.__capy.hud.photoAudit());
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(1200);
  out.on = await page.evaluate(() => {
    const a = window.__capy.hud.photoAudit();
    const el = document.querySelector('.capyui-photo');
    const cap = document.querySelector('.capyui-pcap');
    return { on: a.on, lens: +a.lens.toFixed(3), shown: el && el.classList.contains('show'),
             bare: document.getElementById('hud').classList.contains('bare'),
             caption: cap ? cap.textContent : '',
             opacity: el ? getComputedStyle(el).opacity : '' };
  });
  // ---- the shutter. The download is intercepted so the run does not hang.
  page.on('download', d => { out.file = d.suggestedFilename(); d.path().catch(() => {}); });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  out.after = await page.evaluate(() => window.__capy.hud.photoAudit());
  // and prove the picture is not blank: same render-then-read, measured
  out.png = await page.evaluate(() => {
    const g = window.__capy;
    if (g.post && g.post.enabled) g.post.render(); else g.renderer.render(g.scene, g.camera);
    const u = g.canvas.toDataURL('image/png');
    return { bytes: u.length, head: u.slice(0, 22) };
  });
  await page.keyboard.press('KeyK');
  await page.waitForTimeout(900);
  out.off = await page.evaluate(() => ({
    on: window.__capy.hud.photoAudit().on,
    bare: document.getElementById('hud').classList.contains('bare'),
  }));
  out.err = await page.evaluate(() => String(window.__capy.state.lastError));
  await page.evaluate((o) => fetch('/shot?name=w34k.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
