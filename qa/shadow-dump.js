async page => {
  await page.reload();
  await page.waitForTimeout(5200);
  const out = await page.evaluate(() => {
    const T = window.__capy.THREE;
    const ch = T.ShaderChunk.shadowmap_pars_fragment;
    const i = ch.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
    const j = ch.indexOf('#elif', i + 10);
    return { len: ch.length, soft: ch.slice(i, j > 0 ? j : i + 2200) };
  });
  await page.evaluate(o => fetch('/shot?name=shadowchunk.json', { method: 'POST',
    body: btoa(unescape(encodeURIComponent(JSON.stringify(o, null, 1)))) }), out);
}
