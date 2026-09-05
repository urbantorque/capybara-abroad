async page => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.reload();
  await page.waitForTimeout(6000);
  const m1 = await page.evaluate(() => {
    const g = window.__capy;
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const caps = [...document.querySelectorAll('.capyui-card *')].filter(e => { const cs = getComputedStyle(e); return cs.textTransform === 'uppercase' && e.children.length === 0 && e.textContent.trim() && e.offsetParent; }).map(e => e.className + ':' + e.textContent.trim().slice(0, 40));
    const says = [...document.querySelectorAll('#hud *')].filter(e => /say|bubble|speech/i.test(e.className) && e.offsetParent).map(e => e.className + ':' + e.textContent.trim().slice(0, 30));
    const cam = g && g.camera ? g.camera.position.toArray().map(v => +v.toFixed(1)) : null;
    const capy = g && g.capy && g.capy.body ? g.capy.body.position.toArray().map(v => +v.toFixed(1)) : (g && g.player ? Object.keys(g.player) : null);
    const gkeys = g ? Object.keys(g).slice(0, 60) : null;
    return { card: r('.capyui-card'), mast: r('.capyui-mast svg'), go: r('.capyui-go'), legend: r('.capyui-legbig'), foot: r('.capyui-foot'), caps, says, cam, capy, gkeys,
      font: getComputedStyle(document.querySelector('.capyui-card')).fontFamily,
      titleBg: getComputedStyle(document.querySelector('.capyui-title')).backdropFilter,
      hudChildren: [...document.getElementById('hud').children].map(e => e.className.slice(0, 40)) };
  });
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(1500);
  const m2 = await page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; };
    const caps = [...document.querySelectorAll('.capyui-card *')].filter(e => { const cs = getComputedStyle(e); return cs.textTransform === 'uppercase' && e.children.length === 0 && e.textContent.trim() && e.offsetParent; }).map(e => e.className + ':' + e.textContent.trim().slice(0, 40));
    return { card: r('.capyui-card'), hero: r('.capyui-pick.hero'), heroArt: r('.capyui-pick.hero .capyui-pickart'), heroBody: r('.capyui-pick.hero .capyui-pickbody'), tile: r('.capyui-picks .capyui-pick'), caps,
      heroBodyBg: getComputedStyle(document.querySelector('.capyui-pick.hero .capyui-pickbody')).backgroundImage.slice(0, 200) };
  });
  await page.evaluate(o => fetch('/shot?name=aud-measure.json', { method: 'POST', body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), { m1, m2 });
}
