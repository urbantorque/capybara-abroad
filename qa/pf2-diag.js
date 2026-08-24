async page => {
  const out = {};
  out.ls = await page.evaluate(() => {
    const raw = localStorage.getItem('capy3.album.v1');
    return { present: !!raw, len: raw ? raw.length : 0 };
  });
  await page.reload();
  await page.evaluate(() => new Promise(r => setTimeout(r, 5000)));
  out.atTitle = await page.evaluate(() => {
    const g = window.__capy;
    const r = { hasCapy: !!g, hasHud: !!(g && g.hud), started: g ? !!g.state.started : null };
    try { r.audit = g.hud.albumAudit(); } catch (e) { r.auditErr = String(e); }
    const arts = document.querySelectorAll('.capyui-pickart');
    r.tiles = arts.length;
    r.firstArtHTML = arts[0] ? arts[0].outerHTML.slice(0, 300) : null;
    r.anyImgAnywhere = document.querySelectorAll('.capyui-pickshot').length;
    return r;
  });
  await page.evaluate(o => fetch('/shot?name=pf2-diag.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
